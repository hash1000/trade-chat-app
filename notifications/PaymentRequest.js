const Notification=require('./Notification');

class PaymentRequest extends Notification{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'Payment Request',
            body: `${this.user.name} has sent you a payment request.`
        }
    }
}
module.exports = PaymentRequest;

