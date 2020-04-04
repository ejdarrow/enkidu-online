var express = require('express');
var app = express();
var path = require('path');
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// The server plumbing

http.listen(port, () => {
	console.log("Server listening on %d", port);
});


//Routing

app.use(express.static(path.join(__dirname, 'public')));


// Sockets

var numUsers = 0;
var maxUsers = 10;
var locations = {};

io.on('connection', function(socket){
	var addedUser = false;
	socket.on('move', (data) => {
		data["username"] = socket.username;
		locations[socket.username] = data;

		//Move management happens here.
		
		var frameData = {};
		frameData["frame"] = "Update Frame Somehow";
		frameData["userX"] = data.location.x;
		frameData["userY"] = data.location.y;
		io.emit('redraw', frameData);
	});

	
	socket.on('add user', (username) => {
		if(username in locations){
			socket.emit('kick', { reason: "exists" });
			socket.disconnect();
		} else if (numUsers >= maxUsers) {
			socket.emit('kick', { reason: "max" });
			socket.disconnect();
		} else {
			socket.username = username;
			++numUsers;		
			addedUser = true;

			//Here will go the max room size logic

			socket.emit('login', {
				numUsers: numUsers
			});

			socket.broadcast.emit('user joined', {
				username: socket.username,
				numUsers: numUsers
			});
		}
	});
	socket.on('exit editor', () => {
		socket.emit('exit editor');
	});	
	socket.on('typing', () => {
		socket.broadcast.emit('typing', {
			username: socket.username
		});
	});

	socket.on('stop typing', () => {
		socket.broadcast.emit('stop typing', {
			username: socket.username
		});
	});


	socket.on('disconnect', () => {
		if(addedUser){
			--numUsers;
			delete locations[socket.username];
		}
		
		socket.broadcast.emit('user left', {
			username : socket.username,
			numUsers : numUsers
		});
	});


	socket.on('new message', function(msg){
		if(msg == "/editor"){
			socket.emit("open editor");
		} else {
			socket.broadcast.emit('new message', {
				username : socket.username,
				message : msg
			});
		}
	});
});

