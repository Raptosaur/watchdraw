const express = require('express');
const app = express();
const http = require('http').Server(app);
const fetch = require('node-fetch');
const io = require('socket.io')(http);

// https://coolors.co/000000-ffffff-494949-7c7a7a-ff5d73

const rooms = {};

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('pages/index');
});

app.get('/draw', (req, res) => {
    res.render('pages/draw');
});

app.use(express.static('public'));

http.listen(8080, () => {
    console.log('App is live on 8080.');
});

io.on('connection', (socket) => {
    console.log(`${socket.id} has connected`);

    socket.on('disconnect', () => {
        if(socket.room){
            io.to(socket.room).emit('clientCount', numClientsInRoom(socket.room));
        }
        console.log(`${socket.id} has disconnected`);
    })

    socket.on('join', room => {
        room = room.toLowerCase();
        console.log(`${socket.id} has joined room "${room}"`);
        socket.join(room);
        socket.room = room;

        io.to(room).emit('clientCount', numClientsInRoom(room));
    })

    socket.on('createRoom', passphrase => {
        const id = makeId(7);
        rooms[id] ={
            roomId: id, 
            passphrase
        };
        socket.emit('created', JSON.stringify({
            roomId: id
        }));
        socket.join(id);
        socket.room = id;
        console.log(`${socket.id} has created room "${id}"`);
        io.to(id).emit('clientCount', numClientsInRoom(id));
    })

    socket.on('draw', data => {
        if(!socket.room){
            socket.disconnect();
            return;
        }
        data = JSON.parse(data);
        if(rooms[socket.room] && data.passcode === rooms[socket.room].passphrase){
            const jsonRPCRequest = {
                jsonrpc: "2.0",
                method: "generateIntegers",
                params:
                    {
                        apiKey: process.env.API_KEY,
                        n: 1,
                        min: data.lowerLimit,
                        max: data.upperLimit,
                        replacement: true,
                        base: 10
                    },
                id: 15200
            };
            fetch("https://api.random.org/json-rpc/2/invoke", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(jsonRPCRequest),
            }).then((response) => {
                if (response.status === 200) {
                    response.json().then(data => {
                        if(data.result)
                            io.to(socket.room).emit('drawResult', data.result.random.data[0])
                    });
                } else if (jsonRPCRequest.id !== undefined) {
                    console.error('Error');
                }
            })
        }
    })

    socket.on('startConfetti', () => {
        io.emit('confetti', true);
    })
})

const numClientsInRoom = (room) => {
    if(!io.sockets.adapter.rooms[room])
        return;
    try{
        const clients = io.sockets.adapter.rooms[room].sockets;
        return Object.keys(clients).length;
    }catch(e){
        console.error(e);
    }
    return 0;
}

const makeId = (length) => {
    var result           = '';
    var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }
