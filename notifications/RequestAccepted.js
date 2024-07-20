const Notification=require('./Notification');

class RequestAccepted extends Notification{
    constructor(token,data,user) {
        super(token,data);
        this.user = user;
    }

    getNotification(){
        return {
            title: 'Request Accepted',
            body: `${this.user.name} accepted your request.`
        }
    }
}
module.exports = RequestAccepted;
