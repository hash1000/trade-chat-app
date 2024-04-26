const Notification=require('./Notification');

class PaymentRequestUpdate extends Notification{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'Payment Request Update',
            body: `Payment request from ${this.user.name} has been updated.`
        }
    }
}
module.exports = PaymentRequestUpdate;
