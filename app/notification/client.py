import httpx
import asyncio

from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.logger import get_logger
from app import on_startup
from app.notification.queue_manager import (
    telegram_queue,
    discord_queue,
    enqueue_telegram,
    enqueue_discord,
    TelegramNotification,
    DiscordNotification,
)


client = None


async def define_client():
    """
    Re-create the global httpx.AsyncClient.
    Call this function after changing the proxy setting.
    """
    global client
    if client and not client.is_closed:
        asyncio.create_task(client.aclose())
    client = httpx.AsyncClient(
        http2=True,
        timeout=httpx.Timeout(10),
        proxy=(await notification_settings()).proxy_url,
    )


on_startup(define_client)

logger = get_logger("Notification")


async def _send_discord_webhook_direct(json_data, webhook, max_retries: int) -> bool:
    """
    Internal function to send Discord webhook with proper retry_after handling.
    Returns True if successful, False otherwise.
    """
    retries = 0
    while retries < max_retries:
        try:
            response = await client.post(webhook, json=json_data)
            if response.status_code in [200, 204]:
                logger.debug(f"Discord webhook payload delivered successfully, code {response.status_code}.")
                return True
            elif response.status_code == 429:
                retries += 1
                if retries < max_retries:
                    # Extract retry_after from response
                    try:
                        retry_after = response.json().get("retry_after", 0.5)
                    except Exception:
                        retry_after = 0.5
                    logger.warning(f"Discord rate limit hit, waiting {retry_after}s (attempt {retries}/{max_retries})")
                    await asyncio.sleep(retry_after)
                    continue
            else:
                response_text = response.text
                logger.error(f"Discord webhook failed: {response.status_code} - {response_text}")
                return False
        except Exception as err:
            logger.error(f"Discord webhook failed Exception: {str(err)}")
            return False

    logger.error(f"Discord webhook failed after {max_retries} retries")
    return False


async def send_discord_webhook(json_data, webhook):
    """Enqueue Discord notification for processing"""
    await enqueue_discord(json_data, webhook)


async def _send_telegram_message_direct(
    message: str,
    chat_id: int | None,
    channel_id: int | None,
    topic_id: int | None,
    max_retries: int,
    telegram_api_token: str,
) -> bool:
    """
    Internal function to send Telegram message with proper retry_after handling.
    Returns True if successful, False otherwise.
    """
    base_url = f"https://api.telegram.org/bot{telegram_api_token}/sendMessage"
    payload = {"parse_mode": "HTML", "text": message}

    # Determine the target chat/channel/topic
    if topic_id and channel_id:
        payload["chat_id"] = channel_id
        payload["message_thread_id"] = topic_id
    elif channel_id:
        payload["chat_id"] = channel_id
    elif chat_id:
        payload["chat_id"] = chat_id
    else:
        logger.error("At least one of chat_id, channel_id must be provided")
        return False

    retries = 0
    while retries < max_retries:
        try:
            response = await client.post(base_url, data=payload)
            if response.status_code == 200:
                logger.debug(f"Telegram message sent successfully, code {response.status_code}.")
                return True
            elif response.status_code == 429:
                retries += 1
                if retries < max_retries:
                    # Extract retry_after from Telegram response
                    try:
                        retry_after = response.json().get("parameters", {}).get("retry_after", 0.5)
                    except Exception:
                        retry_after = 0.5
                    logger.warning(f"Telegram rate limit hit, waiting {retry_after}s (attempt {retries}/{max_retries})")
                    await asyncio.sleep(retry_after)
                    continue
            else:
                response_text = response.text
                logger.error(f"Telegram message failed: {response.status_code} - {response_text}")
                return False
        except Exception as err:
            logger.error(f"Telegram message failed: {str(err)}")
            return False

    logger.error(f"Telegram message failed after {max_retries} retries")
    return False


async def send_telegram_message(
    message, chat_id: int | None = None, channel_id: int | None = None, topic_id: int | None = None
):
    """
    Enqueue a Telegram message for processing.
    Args:
        message (str): The message to send
        chat_id (int, optional): The chat ID for direct messages
        channel_id (int, optional): The channel ID for channel messages
        topic_id (int, optional): The topic ID for forum topics in channels
    """
    await enqueue_telegram(message, chat_id, channel_id, topic_id)


async def process_telegram_queue():
    """
    Process Telegram notification queue, sending messages one by one.
    """
    settings: NotificationSettings = await notification_settings()
    if not settings.telegram_api_token:
        return

    processed = 0
    failed = 0

    while not telegram_queue.empty():
        try:
            notification: TelegramNotification = await telegram_queue.get()

            success = await _send_telegram_message_direct(
                message=notification.message,
                chat_id=notification.chat_id,
                channel_id=notification.channel_id,
                topic_id=notification.topic_id,
                max_retries=settings.max_retries,
                telegram_api_token=settings.telegram_api_token,
            )

            if success:
                processed += 1
            else:
                failed += 1
        except Exception as err:
            logger.error(f"Error processing Telegram notification: {str(err)}")
            failed += 1

    if processed > 0 or failed > 0:
        logger.info(f"Telegram queue processed: {processed} sent, {failed} failed")


async def process_discord_queue():
    """
    Process Discord notification queue, sending webhooks one by one.
    """
    settings: NotificationSettings = await notification_settings()

    processed = 0
    failed = 0

    while not discord_queue.empty():
        try:
            notification: DiscordNotification = await discord_queue.get()

            success = await _send_discord_webhook_direct(
                json_data=notification.json_data, webhook=notification.webhook, max_retries=settings.max_retries
            )

            if success:
                processed += 1
            else:
                failed += 1
        except Exception as err:
            logger.error(f"Error processing Discord notification: {str(err)}")
            failed += 1

    if processed > 0 or failed > 0:
        logger.info(f"Discord queue processed: {processed} sent, {failed} failed")
