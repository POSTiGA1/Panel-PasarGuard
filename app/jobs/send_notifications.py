import asyncio
from datetime import datetime as dt, timedelta as td, timezone as tz

import httpx
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete

from app import on_shutdown, scheduler
from app.db import GetDB
from app.db.models import NotificationReminder
from app.models.settings import Webhook
from app.notification.webhook import queue
from app.settings import webhook_settings
from app.utils.logger import get_logger
from config import JOB_SEND_NOTIFICATIONS_INTERVAL

logger = get_logger("send-notification")


async def send_to_all_webhooks(client: httpx.AsyncClient, notifications, webhooks):
    """
    Send the notifications to all webhooks concurrently.
    Returns True if at least one webhook succeeds.
    """
    if not notifications:
        return True

    payload = jsonable_encoder(notifications)

    async def send_one(webhook):
        webhook_headers = {"x-webhook-secret": webhook.secret} if webhook.secret else None
        try:
            r = await client.post(webhook.url, json=payload, headers=webhook_headers)
            if r.status_code in (200, 201, 202, 204):
                return True
            else:
                logger.error(f"Webhook {webhook.url} failed: {r.status_code} - {r.text}")
        except Exception as err:
            logger.error(f"Webhook {webhook.url} exception: {err}")
        return False

    results = await asyncio.gather(*(send_one(webhook) for webhook in webhooks))
    return any(results)


async def send_notifications():
    settings: Webhook = await webhook_settings()
    if not settings.enable:
        return

    logger.debug("Processing notifications batch")

    processed = 0
    failed_to_requeue = []
    ready_notifications = []
    current_time = dt.now(tz.utc).timestamp()

    try:
        async with httpx.AsyncClient(http2=True, timeout=httpx.Timeout(10), proxy=settings.proxy_url) as client:
            while True:
                try:
                    notification = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                try:
                    if notification.tries >= settings.recurrent:
                        continue

                    if notification.send_at > current_time:
                        failed_to_requeue.append(notification)
                        continue

                    ready_notifications.append(notification)
                except Exception:
                    failed_to_requeue.append(notification)

            if ready_notifications:
                batch_size = 50
                for start in range(0, len(ready_notifications), batch_size):
                    batch = ready_notifications[start : start + batch_size]
                    logger.info(
                        f"Sending batch of {len(batch)} notifications to {len(settings.webhooks)} webhooks "
                        f"(chunk {start // batch_size + 1})"
                    )
                    success = await send_to_all_webhooks(client, batch, settings.webhooks)

                    if not success:
                        retry_at = dt.now(tz.utc).timestamp()
                        for notification in batch:
                            notification.tries += 1
                            if notification.tries < settings.recurrent:
                                notification.send_at = retry_at + settings.timeout
                                failed_to_requeue.append(notification)

                    processed += len(batch)

    finally:
        # Don't requeue failed items if webhook disabled
        if not settings.enable:
            return

        # Requeue failed items at the end
        for notif in failed_to_requeue:
            await queue.put(notif)

        if processed or failed_to_requeue:
            logger.info(f"Processed {processed} notifications, requeued {len(failed_to_requeue)}")


async def delete_expired_reminders() -> None:
    async with GetDB() as db:
        # Get current UTC time and convert to naive datetime
        now_utc = dt.now(tz=tz.utc)
        now_naive = now_utc.replace(tzinfo=None)

        result = await db.execute(delete(NotificationReminder).where(NotificationReminder.expires_at < now_naive))
        logger.info(f"Cleaned up {result.rowcount} expired reminders")


async def send_pending_notifications_before_shutdown():
    logger.info("Webhook final flush before shutdown")
    await send_notifications()


scheduler.add_job(
    send_notifications, "interval", seconds=JOB_SEND_NOTIFICATIONS_INTERVAL, max_instances=1, coalesce=True
)
scheduler.add_job(delete_expired_reminders, "interval", hours=6, start_date=dt.now(tz.utc) + td(minutes=5))
on_shutdown(send_pending_notifications_before_shutdown)
