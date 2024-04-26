const Notification=require('./Notification');

class AddRequest extends Notification{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'New Add Request',
            body: `${this.user.name} wants to add you.`
        }
    }
}
module.exports = AddRequest;
