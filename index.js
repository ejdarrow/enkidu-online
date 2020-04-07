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

var viewportWidth = 20;
var viewportHeight = 10;

var locations = {};
var areas = [
	"spawn"
];

const loadAreaDetails = (areaName) => {
	try {
		var areaDetails = fs.readFileSync(path.join(__dirname, 'staticAssets/' + areaName + '.json'));
		return JSON.parse(areaDetails);
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
	
	var areaPotentialX = Math.round(xWidth/2) + userPotentialX;
	var areaPotentialY = Math.round(yWidth/2) + userPotentialY;
	
	var charPositionToCheck = areaPotentialX + xWidth * areaPotentialY;
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

const getCharactersInArea = (area) => {
	var areaLocations = {};
	for (key in locations){
		var value = locations[key];
		if("location" in value){
			if("area" in value.location){
				if(value.location.area == area){
					areaLocations[key] = value;
				}
			}
		}
	}
	return areaLocations;
}

const makeCharactersLocalized = (charactersInArea, areaDetails) => {
	var localizedCharacters = {};
	var areaWidth = areaDetails.xWidth * areaWidthFactor;
	var areaHeight = areaDetails.yWidth * areaHeightFactor;
	for(key in charactersInArea) {
		var value = charactersInArea[key];
		var localizedX = value.location.x + Math.round(areaWidth)/2;
		var localizedY = value.location.y + Math.round(areaHeight)/2;
		
		var characterPosition = localizedX + localizedY * areaWidth;
		
		localizedCharacters[characterPosition] = {
			x: localizedX,
			y: localizedY,
			avatar: value.avatar,
			color: value.color,
			username: value.username
		};
	}
	return localizedCharacters;
};

const getViewport = (myLocation, areaDetails) => {
	var localizedCharacterPosition = makeCharactersLocalized({"0":myLocation}, areaDetails);

	var thePosition = {};
	for(var key in localizedCharacterPosition){
		thePosition = localizedCharacterPosition[key];
	}
	var viewport = {};
	
	
	 viewport = {
		minX: thePosition.x - Math.round(viewportWidth / 2),
		maxX: Math.max(thePosition.x + Math.round(viewportWidth / 2), viewportWidth),
		minY: thePosition.y - Math.round(viewportHeight / 2),
		maxY: Math.max(thePosition.y + Math.round(viewportHeight / 2), viewportHeight),
		dimX: areaDetails.xWidth * areaWidthFactor,
		dimY: areaDetails.yWidth * areaHeightFactor
	};
	
	return viewport;
}
const inView = (i, viewport) => {
	var x = i % viewport.dimX;
	var y = Math.floor(i / viewport.dimX);
	if(x >= viewport.minX && x <= viewport.maxX && y >= viewport.minY && y <= viewport.maxY){
		return true;
	} else {
		return false;
	}
}

const handleNewLines = (i, viewport) => {
	var x = i % viewport.dimX;
	var y = Math.floor(i / viewport.dimX);
	if((x == (viewport.dimX - 1))&& y >= viewport.minY && y <= viewport.maxY){
		return true;
	} else {
		return false;
	}
}

const renderFrame = (areaDetails, myLocation) => {
	var frameText = "";
    var xWidth = Math.round(areaDetails.xWidth) * areaWidthFactor;
    var yWidth = Math.round(areaDetails.yWidth) * areaHeightFactor;
		var appropriateLength = xWidth * yWidth;

		var graphicsValue = areaDetails.graphics.replace(/\n/g, "");
		var collidersValue = areaDetails.colliders.replace(/\n/g, "");
		var colorsValue = areaDetails.colors.replace(/\n/g, "");;
		
		var previewColorMap = getPreviewColorMap();

		var charactersInArea = getCharactersInArea(areaDetails.name);
		var localizedCharacters = makeCharactersLocalized(charactersInArea, areaDetails);
		
		//TODO: Clip view to viewport
		
		var viewport = getViewport(myLocation, areaDetails);

		for(var i = 0; i < appropriateLength; i++){
			if(inView(i, viewport)){
				var color = "";
				if(i in localizedCharacters){
					color = localizedCharacters[i].color;
				} else {
					color = previewColorMap[colorsValue.charAt(i)] || "#000000";
				}
				var element = "<span style=\"white-space:pre; color:" + color + "; ";
				
				if(i in localizedCharacters && localizedCharacters[i].username == myLocation.username){
					element += "text-decoration:underline;";
				}
				
				element += "\"";
				
				element += ">";
				if(i in localizedCharacters){
					element += localizedCharacters[i].avatar;
				} else {
					element += graphicsValue.charAt(i);
				}
				element += "</span>";
				frameText += element;
				
			}
			if(handleNewLines(i, viewport)){
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
				avatar: socket.username?socket.username.charAt(0):"-",
				color: "#FF0000"
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
			socket.emit("draw error", "" + err);
		}

		try {
			frameData["frame"] = renderFrame(areaDetails, locations[socket.username]);
		} catch (err) {
			socket.emit("draw error", "" + err);
		}
		io.to(area + "_area").emit('redraw', frameData); // Gotta do something here.
		
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

