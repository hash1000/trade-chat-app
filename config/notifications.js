const NOTIFICATION_TEMPLATES = {
    NEW_MESSAGE: {
        title: 'New Message',
        body: 'You have a new message from {senderName}.'
    },
    PAYMENT_REQUEST: {
        title: 'Payment Request',
        body: '{senderName} has sent you a payment request.'
    },
    PAYMENT_REQUEST_UPDATE: {
        title: 'Payment Request Update',
        body: 'Payment request from {senderName} has been updated.'
    },
    PAYMENT_RECEIVED: {
        title: 'Payment Received',
        body: 'You have received a payment from {senderName}.'
    },
    PAYMENT_GENERAL_UPDATE: {
        title: 'Payment Update',
        body: 'Your payment status has been updated.'
    },
    ORDER_UPDATE: {
        title: 'Order Update',
        body: 'Your order with ID {orderId} has been updated.'
    }
};
module.exports = NOTIFICATION_TEMPLATES;
