const Notification=require('./Notification');
class NewMessage extends Notification{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'New Message',
            body: `You have a new message from ${this.user.name}`
        }
    }
}

module.exports = NewMessage;
