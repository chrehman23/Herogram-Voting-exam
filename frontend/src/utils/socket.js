// utils/socket.js
import { io } from "socket.io-client";

const socket = io(process.env.REACT_APP_API_URL, {
 transports: ['websocket', 'polling'],
 autoConnect: true,
});

socket.on("connect", async () => {
 console.log("Connected to the socket server.");
});

socket.on("disconnect", () => {
 console.log("Disconnected from the socket server.");
});


export const listenToEvent = (event, callback) => {
 socket.on(event, callback);
};

export const clearEventListener = (event) => {
 socket.off(event);
};

export default socket;
