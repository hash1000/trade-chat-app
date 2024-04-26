const Notification=require('./Notification');

class OrderUpdate extends Notification
{
    constructor(token,data) {
        super(token,data);
    }

    getNotification(){
        return {
            title: 'Order Update',
            body: `Your order with ID ${this.data.id} has been updated.`
        }
    }
}
module.exports = OrderUpdate;
