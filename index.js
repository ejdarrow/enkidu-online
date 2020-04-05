var express = require('express');
var app = express();
var path = require('path');
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var fs = require('fs');


// The server plumbing

http.listen(port, () => {
	console.log("Server listening on %d", port);
});


//Routing

app.use(express.static(path.join(__dirname, 'public')));


// Sockets

var numUsers = 0;
var maxUsers = 10;
var areaWidthFactor = 40;
var areaHeightFactor = 20;
var locations = {};
var areas = [
	"spawn"
];

const loadAreaDetails = (areaName) => {
	try {
		var areaDetails = fs.readFileSync(path.join(__dirname, 'staticAssets/' + areaName + '.json'));
		return areaDetails;
	} catch (err) {
		console.log(err);
	}
};

var defaultNonColliders = [ " ", "0"];
const checkCollision = (areaDetails, potentialPosition) => {
	var xWidth = areaDetails.xWidth * areaWidthFactor;
	var yWidth = areaDetails.yWidth * areaHeightFactor;
	
	var userPotentialX = potentialPosition.x;
	var userPotentialY = potentialPosition.y;
	
	var areaPotentialX = Math.round(xWidth/2) + userPotentailX;
	var areaPotentialY = Math.round(yWidth/2) + userPotentialY;
	
	var charPositionToCheck = areaPotentialX + xWidth * areaPotentialY - 1;
	if(defaultNonColliders.includes(areaDetails.colliders.charAt(charPositionToCheck))){
		return "pass";
	} else { //Do other collision-triggered things here
		return "collide";
	}
};

//Testing mode right now.
const getPreviewColorMap = () => {
	return {
		"0": "#000000",
		"1": "#FF0000",
		"2": "#00FF00",
		"3": "#0000FF"			
	};
}

const renderFrame = (areaDetails) => {
	var frameText = "";
    var xWidth = Math.round(areaDetails.xWidth) * areaWidthFactor;
    var yWidth = Math.round(areaDetails.yWidth) * areaHeightFactor;
		var appropriateLength = xWidth * yWidth;

		var graphicsValue = areaDetails.graphics.replace(/\n/g, "");
		var collidersValue = areaDetails.colliders.replace(/\n/g, "");
		var colorsValue = areaDetails.colors.replace(/\n/g, "");;
		
		var previewColorMap = getPreviewColorMap();

		//TODO: Get character locations as a map
		//TODO: Clip view to viewport

		for(var i = 0; i < appropriateLength; i++){
			var collider = false;
			var color = previewColorMap[colorsValue.charAt(i)] || "#000000";
			var element = "<span style=\"white-space:pre; color:" + color + "; ";
			element += "\"";
			
			element += ">";
			element += graphicsValue.charAt(i);

			element += "</span>";
			frameText += element;
			if(i%(xWidth) == (xWidth - 1)){
				frameText += "<br/>";
			}
		}
		return frameText;
};

io.on('connection', function(socket){
	var addedUser = false;
	socket.on('move', (data) => {
		data["username"] = socket.username;
		var frameData = {};
		var area;
		//Initialize
		if(!(socket.username in locations)){
			locations[socket.username] = {
				location: {
					x:0,
					y:0,
					area:"spawn"
				},
				username: socket.username,
				avatar: socket.username.substring(0, 2)
			}; //More to come here.
			area = "spawn";
			socket.join(area + "_area");
		}
		
		area = locations[socket.username].location.area;
		var direction = data.direction;
		var areaDetails = loadAreaDetails(area);
		var potentialPosition = {
			x: locations[socket.username].location.x,
			y: locations[socket.username].location.y
		};
		switch(direction) {
			case "U":
				potentialPosition.y -= 1;
				break;
			case "D":
				potentialPosition.y += 1;
				break;
			case "L":
				potentialPosition.x -= 1;
				break;	
			case "R":
				potentialPosition.x += 1;
				break;
		}
		//Move management happens here.
		try {
			var result = checkCollision(areaDetails, potentialPosition);
			switch(result) {
				case "collide":
					break;
				case "pass":
					locations[socket.username].location.x = potentialPosition.x;
					locations[socket.username].location.y = potentialPosition.y;
					break;
			}
		} catch (err) {
			socket.emit("draw error", "Collision detection failure.");
		}

		try {
			frameData["frame"] = renderFrame(areaDetails, locations[socket.username].location);
		} catch (err) {
			socket.emit("draw error", "Area " + area + " not found.");
		}
		io.to(area + "_area").emit('redraw', frameData);
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

