const axios = require('axios');
class Notification{
    constructor(token,data) {
        this.token =token;
        this.data=data;
    }

    async sendNotification() {
        const notificationData = {
            notification: this.getNotification(),
            data: this.getData(),
            to: this.token,
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `key=${process.env.FCM_SERVER_KEY}`,
            },
        };

        axios
            .post('https://fcm.googleapis.com/fcm/send', notificationData, config)
            .then((response) => {
            })
            .catch((error) => {
                console.error('Error sending notification:', error);
            });
    }

    getData(){
        return { data: JSON.stringify(this.data) }  ;
    }
}
module.exports = Notification;
