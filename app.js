import { Server } from "socket.io";

const io = new Server({
    cors: {
        origin: "http://localhost:5173",
    },
});

let onlineUsers = [];
let chats = []; // Массив чатов для тестов. Замените на запросы к базе данных в реальном проекте.

const addUser = (userId, socketId) => {
    const userExists = onlineUsers.find((user) => user.userId === userId);
    if (!userExists) {
        onlineUsers.push({ userId, socketId });
        console.log(`Added user: ${userId}`);
    }
};

const removeUser = (socketId) => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
    console.log(`Removed user with socket: ${socketId}`);
};

const getUser = (userId) => {
    return onlineUsers.find((user) => user.userId === userId);
};

const getUnreadMessagesCount = (userId) => {
    return chats.reduce((count, chat) => {
        if (chat.userIDs.includes(userId) && !chat.seenBy.includes(userId)) {
            count += chat.messages.filter(
                (message) => message.userId !== userId && !message.readBy.includes(userId)
            ).length;
        }
        return count;
    }, 0);
};

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Добавление нового пользователя
    socket.on("newUser", (userId) => {
        addUser(userId, socket.id);

        // Вычисление количества непрочитанных сообщений
        const unreadMessages = getUnreadMessagesCount(userId);

        // Отправка количества непрочитанных сообщений
        io.to(socket.id).emit("notification", { unreadMessages });
    });

    // Обработка отправки сообщения
    socket.on("sendMessage", ({ receiverId, chatId, data }) => {
        const receiver = getUser(receiverId);
        const chat = chats.find((c) => c.id === chatId);

        if (chat) {
            // Добавление сообщения в чат
            chat.messages.push({
                ...data,
                userId: receiverId,
                readBy: [], // Список пользователей, которые прочитали сообщение
            });

            if (receiver) {
                io.to(receiver.socketId).emit("getMessage", data);

                // Пересчет количества непрочитанных сообщений
                const unreadMessages = getUnreadMessagesCount(receiverId);
                io.to(receiver.socketId).emit("notification", { unreadMessages });
            }
        } else {
            console.error(`Chat not found: ${chatId}`);
        }
    });

    socket.on("markAsRead", (chatId) => {
        const userId = onlineUsers.find((user) => user.socketId === socket.id)?.userId;
        const chat = chats.find((c) => c.id === chatId);

        if (userId && chat) {
            // Обновляем список прочитанных сообщений
            chat.messages.forEach((message) => {
                if (!message.readBy.includes(userId)) {
                    message.readBy.push(userId);
                }
            });

            // Добавляем пользователя в список `seenBy`
            if (!chat.seenBy.includes(userId)) {
                chat.seenBy.push(userId);
            }

            // Пересчет непрочитанных сообщений
            const unreadMessages = getUnreadMessagesCount(userId);
            io.to(socket.id).emit("notification", { unreadMessages });
        }
    });

    // Удаление пользователя при отключении
    socket.on("disconnect", () => {
        removeUser(socket.id);
    });
});

// Запуск сервера
io.listen(4000);
console.log("Socket.io server is running on port 4000");
