#!/usr/bin/env node

/**
 * Module dependencies.
 */
require('dotenv').config()
const app = require('../app')
const cors = require('cors')
const debug = require('debug')('customerapi:server')
const http = require('http')
const jwt = require('jsonwebtoken')
const UserService = require('../services/UserService')
const Message = require('../models/message')
const PaymentRequest = require('../models/payment_request')
app.use(cors())
const socket = require('../config/socket')
const Chat = require('../models/chat')
const User = require('../models/user')
const { Op } = require('sequelize')
const sequelize = require('../config/database')
const InSufficientBalance = require('../errors/InSufficientBalance')
const {NewMessageNotification,OrderUpdateNotification,PaymentReceivedNotification,PaymentRequestNotification,PaymentRequestUpdateNotification}=require('../notifications')
/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000')
app.set('port', port)

/**
 * Create HTTP server.
 */

const server = http.createServer(app)
// Initialize Socket.IO using the socket module
socket.init(server)


// Now you can get the Socket.IO instance from the socket module
const io = socket.getIO()

// Authentication middleware for Socket.IO
io.use(async (socket, next) => {
  const token = socket.handshake.query.token
  if (!token) {
    return next(new Error('Missing token'))
  }

  try {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET_KEY)
    const { userId, tokenVersion } = decoded

    const userService = new UserService()
    const user = await userService.getUserById(userId)
    if (!user || user.tokenVersion !== tokenVersion) {
      return next(new Error('Invalid or expired token'))
    }

    socket.user = user
    next()
  } catch (error) {
    return next(new Error('Invalid or expired token'))
  }
})
io.on('disconnect', async (socket) => {
  console.log('user disconnected')
  const userService = new UserService()
  userService.updateUserStatus(socket.user.id, false)
})
io.on('connection', (socket) => {
  console.log('a user connected')
  const userService = new UserService()
  userService.updateUserStatus(socket.user.id, true)

  // Join the user to a room for their user ID
  socket.join(`user-${socket.user.id}`)

  socket.on('join chat room', async (chatId) => {
    const chat = await Chat.findOne({
      where: {
        [Op.or]: [
          { user1Id: socket.user.id },
          { user2Id: socket.user.id }
        ],
        id: chatId
      }
    })

    if (!chat) {
      console.log(`User ${socket.user.id} Not allowed to join to this chat: ${chatId}`)
      return socket.emit('error', 'Not allowed to join the chat')
    }
    socket.join(`chat-${chatId}`)
    console.log(`User ${socket.user.id} joined chat room: ${chatId}`)
  })

  socket.on('leave chat room', (chatId) => {
    console.log(chatId)
    socket.leave(`chat-${chatId}`)
    console.log(`User ${socket.user.id} left chat room: ${chatId}`)
  })

  // Handle chat messages
  socket.on('chat message', async (msg) => {
    if (!msg.chatId) {
      console.log('Chat id not given')
      return socket.emit('error', 'Chat id not given')
    }
    const chat = await Chat.findOne({
      where: {
        [Op.or]: [
          { user1Id: socket.user.id },
          { user2Id: socket.user.id }
        ],
        id: msg.chatId
      }
    })

    if (!chat) {
      console.log(`User ${socket.user.id} Not allowed to send message to this chat: ${chatId}`)
      return socket.emit('error', 'Not allowed to send message to this chat')
    }

    if (msg.quoteToId) {

    const quotedMessage = await Message.findOne({
      where: {
        id: msg.quoteToId,
        chatId: msg.chatId
      }
    })
    if (!quotedMessage) {
      console.log('Quoted message id not found')
      return socket.emit('error', 'Quoted message not found')
    }
    }

    const message = await Message.create({
      chatId: msg.chatId,
      senderId: msg.senderId,
      text: msg.text,
      quoteToId: msg.quoteToId || null,
      local_id: msg.local_id || null,
      fileUrl: msg.fileUrl || null,
      settings: msg.settings || {}
    }).catch((e) => {
      console.log(e)
    })

    const messageUpdated = await Message.findOne({ where: { id: message.id }, include: [
      {
          model: Message,
          as: 'replyTo',
          include: [{ model: PaymentRequest }]
        }
      ]})

    // Emit the message to the chat room
    io.to(`chat-${msg.chatId}`).emit('message event', messageUpdated)
    const otherUserId =chat.user1Id===socket.user.id  ? chat.user2Id : chat.user1Id;
    const otherUser = await User.findOne({where:{id:otherUserId}})
    // io.to(`user-${otherUser.id}`).emit('message event', messageUpdated)
    await new NewMessageNotification(otherUser.fcm,messageUpdated,socket.user).sendNotification();
  })

  socket.on('update message', async (msg) => {
    if (!msg.id) {
      console.log('Message id not given')
      return socket.emit('error', 'Message id not given')
    }
    if (!msg.chatId) {
      console.log('Chat id not given')
      return socket.emit('error', 'Chat id not given')
    }
    const chat = await Chat.findOne({
      where: {
        [Op.or]: [
          { user1Id: socket.user.id },
          { user2Id: socket.user.id }
        ],
        id: msg.chatId
      }
    })
    if (!chat) {
      console.log(`User ${socket.user.id} Not allowed to update message in this chat: ${chatId}`)
      return socket.emit('error', 'Not allowed to update message in this chat')
    }
    if (msg.isDeleted) {
      await Message.update({
        isDeleted: true
      }, {
        where: {
          id: msg.id
        }
      }).catch((e) => {
        console.log(e)
      })
    } else if (msg.text) {
      await Message.update({
        text: msg.text
      }, {
        where: {
          id: msg.id
        }
      }).catch((e) => {
        console.log(e)
      })
    }
    const messageUpdated = await Message.findOne({ where: { id: msg.id }, include: [
      {
          model: Message,
          as: 'replyTo',
          include: [{ model: PaymentRequest }]
        }
      ]})

    // Emit the message to the chat room
    io.to(`chat-${msg.chatId}`).emit('message updated', messageUpdated)
    // io.to(`user-${chat.user1Id}`).emit('message updated', messageUpdated)
    // io.to(`user-${chat.user2Id}`).emit('message updated', messageUpdated)
  })

  // Handle payment requests
  socket.on('payment request', async (request) => {
    if (socket.user.id !== request.requesterId) {
      return socket.emit('error', 'Authentication error')
    }

    const paymentRequest = await PaymentRequest.create({
      requesterId: request.requesterId,
      requesteeId: request.requesteeId,
      amount: request.amount
    })

    const message = await Message.create({
      chatId: request.chatId,
      senderId: request.requesterId,
      text: `Payment request of ${request.amount}`,
      paymentRequestId: paymentRequest.id
    })

    message.dataValues.PaymentRequest = paymentRequest

    // Emit the payment request to the chat room
    io.to(`chat-${request.chatId}`).emit('payment request', message)
    const requesteeUser = await User.findOne({where:{id:request.requesteeId}})
    // io.to(`user-${requesteeUser.id}`).emit('payment request', message)
    await new PaymentRequestNotification(requesteeUser.fcm,message,socket.user).sendNotification();
  })

  // Handle payment request updates
  socket.on('payment request update', async (request) => {
    const paymentRequest = await PaymentRequest.findOne({ where: { id: request.requestId } })
    if (!paymentRequest || (paymentRequest.requesterId !== socket.user.id && paymentRequest.requesteeId !== socket.user.id)) {
      return socket.emit('error', 'Authentication error')
    }
    if (request.status === 'accepted') {
      transferBalance(paymentRequest.requesteeId, paymentRequest.requesterId, paymentRequest.amount)
        .then(() => {
          // Handle success
        })
        .catch((error) => {
          if (error instanceof InSufficientBalance) {
            return socket.emit('error', 'Not enough balance')
          }
        })
    }

    await PaymentRequest.update({
      status: request.status
    }, {
      where: {
        id: request.requestId
      }
    })
    const paymentRequestUpdated = await PaymentRequest.findOne({ where: { id: request.requestId } })

    // Emit the updated payment request to the chat room
    io.to(`chat-${request.chatId}`).emit('payment request update', paymentRequestUpdated)
    io.to(`user-${paymentRequest.requesteeId}`).emit('payment request update', paymentRequestUpdated)
    const requester = await User.findOne({where:{id:paymentRequest.requesterId}})
    if(request.status === 'accepted'){
      await new PaymentReceivedNotification(requester.fcm,paymentRequestUpdated,socket.user).sendNotification();
    }
    io.to(`user-${paymentRequest.requesterId}`).emit('payment request update', paymentRequestUpdated)
  })

  // Handle payment requests
  socket.on('send money', async (request) => {
    if (socket.user.id !== request.requesterId) {
      return socket.emit('error', 'Authentication error')
    }

    const paymentRequest = await PaymentRequest.create({
      requesterId: request.moneyToUserId,
      requesteeId: request.requesterId,
      amount: request.amount,
      status: "accepted"
    })

    const message = await Message.create({
      chatId: request.chatId,
      senderId: request.requesterId,
      text: `Payment sent: ${request.amount}`,
      paymentRequestId: paymentRequest.id
    })

    message.dataValues.PaymentRequest = paymentRequest
    transferBalance( request.requesterId,   request.moneyToUserId, request.amount)
               .then(() => {
                 // Handle success
               })
               .catch((error) => {
                 if (error instanceof InSufficientBalance) {
                   return socket.emit('error', 'Not enough balance')
                 }
               })


    // Emit the payment request to the chat room
    io.to(`chat-${request.chatId}`).emit('send money update', message)
    const requester = await User.findOne({where:{id:paymentRequest.requesterId}})

    // io.to(`chat-${request.requesterId}`).emit('send money update', message)
    await new PaymentReceivedNotification(requester.fcm,message,socket.user).sendNotification();

  })
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })
})

// add io to the app
app.set('io', io)

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
server.on('error', onError)
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort (val) {
  const port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

/**
 * Event listener for HTTP server "error" event.
 */

async function transferBalance (fromUserId, toUserId, amount) {
  const t = await sequelize.transaction()

  try {
    // Deduct balance from the sender
    const sender = await User.findByPk(fromUserId, { transaction: t })
    if (sender.personalWalletBalance >= amount) {
      sender.personalWalletBalance -= amount
      await sender.save({ transaction: t })

      // Add balance to the receiver
      const receiver = await User.findByPk(toUserId, { transaction: t })
      receiver.personalWalletBalance += amount
      await receiver.save({ transaction: t })

      // Commit the transaction
      await t.commit()

      console.log(`Successfully transferred ${amount} units.`)
    } else {
      await t.rollback()
      throw new InSufficientBalance('Insufficient balance for the transfer.', 400)
    }
  } catch (error) {
    // If any error occurs, roll back the transaction
    await t.rollback()
    console.error('Error transferring balance:', error)
    throw error
  }
}

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening () {
  const addr = server.address()
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port
  debug('Listening on ' + bind)
}
