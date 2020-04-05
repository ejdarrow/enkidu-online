

$(function() {
	var FADE_TIME = 150; //ms
	var TYPING_TIMER_LENGTH = 400; //ms
	var COLORS = [
		'#e21400', '#91580f', '#f8a700', '#f78b00',
		'#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
		'#3b88eb', '#3824aa', '#a700ff', '#d300e7'
	];
	

	//Initialize shit
	var $window = $(window);
	var $usernameInput = $('.usernameInput');
	var $messages = $('.messages');
	var $inputMessage = $('.inputMessage');
	var $gameFrame = $('#gameFrame');

	//Location
	var xLoc = 0; //intss
	var yLoc = 0; 

	var $loginPage = $('.login.page');
	var $chatPage = $('.chat.page');
	var $editorPage = $('.editor.page');
	
        var defaultAreaWidth = 40;
	var defaultAreaHeight = 20;


	var $editorGridX = $("#grid-size-x");
	var $editorGridY = $("#grid-size-y");
	var $editorUnicodeEvaluator = $("#editor-unicode-evaluator");
	var $editorUnicodeOutput = $("#editor-unicode-output");

	var $editorExit = $("#exitEditor");
	var $editorGraphics = $("#graphics-editor");
	var $editorColliders = $("#colliders-editor");
	var $editorColors = $("#colors-editor");
	var $previewArea = $("#previewFrame");
	var $editorOutput = $("#editor-output");

	//Prompt for setting username
	var username;
	var connected = false;
	var dialogState = false;
	var editorState = false;
	var typing = false;
	var lastTypingTime;
	var $currentInput = $usernameInput.focus();

	var socket = io();

	const addParticipantsMessage = (data) => {
		var message = '';
		if(data.numUsers == 1){
			message += "there's 1 participant";
		} else {
			message += "there are " + data.numUsers + " participants";
		}
		log(message);
	}
	
	const addChatWarning = (data) => {
		var message = data;
		log(message);
	}

	const setUsername = () => {
		username = cleanInput($usernameInput.val().trim());
		
		if(username) {
			$loginPage.fadeOut();
			$chatPage.show();
			$chatPage.css("display","flex");
			$loginPage.off('click');
			$currentInput = $inputMessage.focus();

			socket.emit('add user', username);
			sendMove("N");
		}
	}
	
	
	const sendMessage = () => {
		var message = $inputMessage.val();
		
		message = cleanInput(message);
		
		if(message && connected){
			$inputMessage.val('');
			addChatMessage({
				username: username,
				message: message
			});
			socket.emit('new message', message);
		}
	}


	const log = (message, options) => {
		var $el = $('<li>').addClass('log').text(message);
		addMessageElement($el, options);
	}

	
	const addChatMessage = (data, options) => {
		var $typingMessages = getTypingMessages(data);
		options = options || {};
		if($typingMessages.length !== 0) {
			options.fade = false;
			$typingMessages.remove();
		}

		var $usernameDiv = $('<span class="username"/>')
			.text(data.username)
			.css('color', getUsernameColor(data.username));
		var $messageBodyDiv = $('<span class="messageBody">')
			.text(data.message);

		var typingClass = data.typing ? 'typing' : '';
		var $messageDiv = $('<li class="message"/>')
			.data('username', data.username)
			.addClass(typingClass)
			.append($usernameDiv, $messageBodyDiv);

		addMessageElement($messageDiv, options);
	}

	const addChatTyping = (data) => {
		data.typing = true;
		data.message = 'is typing';
		addChatMessage(data);
	}

	const removeChatTyping = (data) => {
		getTypingMessages(data).fadeOut(function() {
			$(this).remove();
		});
	}

	const addMessageElement = (el, options) => {
		var $el = $(el);

		if(!options) {
			options = {};
		}
		if(typeof options.fade === 'undefined') {
			options.fade = true;
		}
		if(typeof options.prepend === 'undefined') {
			options.prepend = false;
		}
		
		if(options.fade) {
			$el.hide().fadeIn(FADE_TIME);
		}
		if(options.prepend) {
			$messages.prepend($el);
		} else {
			$messages.append($el);
		}
		$messages[0].scrollTop = $messages[0].scrollHeight;
	}

	const cleanInput = (input) => { //Sanitize for markup
		return $('<div/>').text(input).html();
	}


	const updateTyping = () => {
		if(connected) {
			if(!typing) {
				typing = true;
				socket.emit('typing');
			}
			lastTypingTime = (new Date()).getTime();
			
			setTimeout(() => {
				var typingTimer = (new Date()).getTime();
				var timeDiff = typingTimer - lastTypingTime;
				if(timeDiff >= TYPING_TIMER_LENGTH && typing) {
					socket.emit('stop typing');
					typing = false;
				}
			}, TYPING_TIMER_LENGTH);
		}
	}

	const getTypingMessages = (data) => {
		return $('.typing.message').filter(function(i) {
			return $(this).data('username') === data.username;
		});
	}

	const getUsernameColor = (username) => {
		var hash = 7;
		for (var i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + (hash << 5) - hash;
		}
		var index = Math.abs(hash % COLORS.length);
		return COLORS[index];
	}


	//Movement handled chiefly on backend.
	// -- Collision detection on backend


	//Draw logic
	
        //Assets is an array of objects with x y theta coords plus color. Will be expanded.
	

	const drawFrame = (frameData) => {
		$gameFrame.text(frameData.frame);
		//Animations and shit can go here too.
	}



	
	const sendMove = (dirCode) => {
		var locationData = {
			direction: dirCode
		};
		socket.emit("move", locationData);
	}

	//Keyboard events

	$window.keydown(event => {
		if(!editorState){
			if(!dialogState && username) { //We are logged in and not dialog
				$currentInput.blur();
				if(event.which === 87 || event.which === 38 ) { // w || up
					sendMove("U");
				} else if(event.which === 65 || event.which === 37) { // a || left
					sendMove("L");
				} else if(event.which === 83 || event.which === 40) { // s || down
					sendMove("D");
				} else if(event.which === 68 || event.which === 39) { // d || right
					sendMove("R");
				}
			}
			if(event.which === 13) { //Pressing enter
				if (username) {
					if(dialogState){
						sendMessage();
						socket.emit('stop typing');
						typing = false;
						$currentInput.blur();
						dialogState = false;
					} else {
						$currentInput.focus()
						dialogState = true;
					}
				} else {
					setUsername();
				}
			}
		}
	});
	
	$inputMessage.on('input', () => {
		updateTyping();
	});
	// Editor shit
	$editorUnicodeEvaluator.on('input', () => {
		$editorUnicodeOutput.html("expect: " + $editorUnicodeEvaluator.val());
	});
	$editorGridX.on('input', () => {
		updateGridSizes();
		updatePreviewFrame();
	});
	$editorGridY.on('input', () => {
		updateGridSizes();
		updatePreviewFrame();
	});
	
	$editorGraphics.on('input', () => {
		updatePreviewFrame();
		arrangeNewLines($editorGraphics);
	});

	$editorColliders.on('input', () => {
		updatePreviewFrame();
		arrangeNewLines($editorColliders);
	});

	$editorColors.on('input', () => {
		updatePreviewFrame();
		updateColorFields();
		arrangeNewLines($editorColors);
	});
	
	const arrangeNewLines = ($e) => {
		var originalValue = $e.val();
		var cursorPos = $e.prop("selectionStart");
		
		originalValue = originalValue.replace(/\n/g, ""); //Strip existing newlines
		var splitValue = [];
		var xWidth = $editorGridX.val() * defaultAreaWidth;
		var yWidth = $editorGridY.val() * defaultAreaHeight;
		for(var i = 0; i < yWidth; i++){
			splitValue.push(originalValue.substring(i*xWidth, (i+1)*xWidth));
		}
		$e.val(splitValue.join("\n"));
		$e.prop("selectionStart", cursorPos);
		$e.prop("selectionEnd", cursorPos);
	}

	const updateColorFields = () => {
		
	}

	//Testing mode right now.
	const getPreviewColorMap = () => {
		return {
			"0": "#000000",
			"1": "#FF0000",
			"2": "#00FF00",
			"3": "#0000FF"			
		};
	}

	const updatePreviewFrame = () => {
		var frameText = "";
        var xWidth = Math.round($editorGridX.val()) * defaultAreaWidth;
        var yWidth = Math.round($editorGridY.val()) * defaultAreaHeight;
		var appropriateLength = xWidth * yWidth;

		var graphicsValue = $editorGraphics.val().replace(/\n/g, "");
		var collidersValue = $editorColliders.val().replace(/\n/g, "");
		var colorsValue = $editorColors.val().replace(/\n/g, "");;
		
		var previewColorMap = getPreviewColorMap();

		if(graphicsValue.length < appropriateLength){
			graphicsValue = graphicsValue.concat("-".repeat(appropriateLength - graphicsValue.length));
		}
		if(collidersValue.length < appropriateLength){
			collidersValue = collidersValue.concat("0".repeat(appropriateLength - collidersValue.length));
		}
		if(colorsValue.length < appropriateLength){
			colorsValue = colorsValue.concat("0".repeat(appropriateLength - colorsValue.length));
		}
		//Everything is now padded out.
		for(var i = 0; i < appropriateLength; i++){
			var collider = false;
			var color = previewColorMap[colorsValue.charAt(i)] || "#000000";
			var element = "<span style=\"white-space:pre; color:" + color + "; ";
			if(collidersValue.charAt(i) == "0"){
				element += "text-decoration:line-through;\"";
			} else {
				element += "\"";
			}
			element += ">";
			element += graphicsValue.charAt(i);

			element += "</span>";
			frameText += element;
			if(i%(xWidth) == (xWidth - 1)){
				frameText += "<br/>";
			}
		}
		$previewArea.html(frameText);
		var output = {};
		output["colliders"] = collidersValue;
		output["graphics"] = graphicsValue;
		output["colors"] = colorsValue;
		output["colorMap"] = previewColorMap;
		output["xWidth"] = xWidth/defaultAreaWidth;
		output["yWidth"] = yWidth/defaultAreaHeight;
		$editorOutput.text("");
		$editorOutput.text(JSON.stringify(output, null, "\t"));
	}
	updatePreviewFrame();


	const updateGridSizes = () => {
		var xWidth = Math.round($editorGridX.val()) * defaultAreaWidth;
		var yWidth = Math.round($editorGridY.val()) * defaultAreaHeight;

		$editorGraphics.attr("cols", xWidth);
		$editorGraphics.attr("rows", yWidth);
		$editorGraphics.attr("maxlength", (xWidth + 1) * yWidth);

		$editorColliders.attr("cols", xWidth);
		$editorColliders.attr("rows", yWidth);
		$editorColliders.attr("maxlength", (xWidth + 1) * yWidth);

		$editorColors.attr("cols", xWidth);
		$editorColors.attr("rows", yWidth);
		$editorColliders.attr("maxlength", (xWidth + 1) * yWidth);
	}
	
	updateGridSizes();



	// Click Events 
	
	$loginPage.click(() => {
		$currentInput.focus();
	});

	$inputMessage.click(() => {
		$inputMessage.focus();
		dialogState = true;
	});

	$editorExit.click(() => {
		socket.emit("exit editor");
	});

	socket.on('open editor', () => {
		editorState = true;
		$chatPage.fadeOut();
		$editorPage.show();
		$editorPage.css("display","flex");
		$chatPage.off("click");
	});

	socket.on('exit editor', () => {
		editorState = false;
		$editorPage.fadeOut();
		$chatPage.show();
		$chatPage.css("display","flex");
		$editorPage.off("click");
		$chatPage.on("click");
	});

	// Socket events
	socket.on('redraw', (assets) => {
		drawFrame(assets);
	});
	socket.on('kick', (reason) => {
		log("You have been kicked because:");
		switch (reason.reason) {
			case "exists": 
				log("Your username already exists");
				break;
			case "max":
				log("Max users connected");
				break;
			default:
				log("We felt like it");
				break;
		}
		
	});
	socket.on('login', (data) => {
		connected = true;
		
		var message = "Enkidu Online";
		log(message, {
			prepend: true
		});
		addParticipantsMessage(data);
		$inputMessage.blur();	
	});

	socket.on('new message', (data) => {
		addChatMessage(data);
	});
	socket.on('draw error', (data) => {
		addChatWarning(data);
	});

	socket.on('user joined', (data) => {
		log(data.username + ' joined');
		addParticipantsMessage(data);
	});

	socket.on('user left', (data) => {
		log(data.username + ' left');
		addParticipantsMessage(data);
		removeChatTyping(data);
		$("#" + data.username + "_avatar").remove();
	});

	socket.on('typing', (data) => {
		addChatTyping(data);
	});

	socket.on('stop typing', (data) => {
		removeChatTyping(data);
	});

	socket.on('disconnect', () => {
		log('you have been disconnected');
	});

	socket.on('reconnect', () => {
		log('you have been reconnected');
		if(username) {
			socket.emit('add user', username);
		}
	});
	
	socket.on('reconnected_error', () => {
		log('attempt to reconnect has failed');
	});
});
