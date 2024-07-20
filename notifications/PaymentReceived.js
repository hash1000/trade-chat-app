const Notification=require('./Notification');

class PaymentReceived extends Notification
{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'Payment Received',
            body: `You have received a payment from ${this.user.name}.`,
        }
    }
}
module.exports = PaymentReceived;
