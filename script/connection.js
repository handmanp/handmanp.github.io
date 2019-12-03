/// ======================
/// connection.js
/// ======================

// Connection Param
"use strict";
let port = 7001;
let dns = {
	global: "https://handmanp.ddns.net",
	local: "https://localhost"
};
let ids = {};
let socket = io.connect(dns.global + ':' + port);
let room = getRoomname();
let joiningRoom;

// Data Transfer Param
let imgTemp = {};
const CHUNK_SIZE = 120000; // slice per 63KB


function dataChannelSend(id, file) {
	let reader = new FileReader();

	reader.onloadend = () => {
		var data = reader.result;
		var size = data.length;

		// hash of img
		var hashObject = new jsSHA('SHA-256', 'TEXT');
		hashObject.update(reader.result);
		var hash = hashObject.getHash("HEX");

		// 
		const chunkNumber = Math.floor(size / CHUNK_SIZE) + 1;
		console.log('Size is:', size);
		console.log('Chunk Number is:', chunkNumber);
		console.log('Send to ' + id);
		for(var i = 0; i < chunkNumber; i++) {
			console.log('Chunk ' + (i+1) + '/' + chunkNumber);
			var dataFragment = data.slice(i * CHUNK_SIZE, (i * CHUNK_SIZE) + CHUNK_SIZE);

			var elem = {
				recData: dataFragment,
				size: size,
				hash: hash
			};

			// console.log('dataFragment:', elem);

			// send data-chunk
			channel[id].send(JSON.stringify(elem));
		}
	};

	reader.readAsDataURL(file);
	
}

function dataChannelReceive(recData, size, hash) {

	// Store received img chunks -> imgTemp{}
	if (!imgTemp[hash]) {
		console.log("size:", size);
		console.log("hash:", hash)
		imgTemp[hash] = recData;
	}
	else {
		imgTemp[hash] += recData;
	}

	console.log('Received: ' + imgTemp[hash].length + '/' + size);

	if (imgTemp[hash].length == size) {
		var data = imgTemp[hash];
		var byteString = atob(data.split(",")[1]);

		var mimeType = data.match(/(:)([a-z\/]+)(;)/)[2];

		for(var i=0, l=byteString.length, content=new Uint8Array(l); l>i; i++) {
			content[i] = byteString.charCodeAt(i);
		}

		// Create ObjectURL from DataURI
		var blob = new Blob([content], {type: mimeType,});
		var objUrl = URL.createObjectURL(blob);

		// console.log('recData:', recData.slice(0, 20) + '...');
		// console.log('obj:', objUrl);

		var span = document.createElement('span');
		span.innerHTML = ['<img class="thumb" src="', objUrl,
        	          '" title="', escape('image'), '"/>'].join('');
		document.getElementById('imgList').insertBefore(span, null);

		delete imgTemp[hash];
	}

}

function createRoom(roomname) {
    socket.emit('create room', roomname);
}

function auth(roomname) {
	joiningRoom = roomname;
	console.log('Auth offer sent', roomname);
	socket.emit('auth offer', roomname);
}

function selectImage(elementId) {
	var hashObject = new jsSHA('SHA-256', 'TEXT');
	hashObject.update(elementId.src);

	var hash = hashObject.getHash("HEX");
	console.log('hash of selected image:', hash);
	socket.emit('auth answer', joiningRoom, hash);
}

function kickMember(id) {
	var kick = window.confirm(id + 'を退場させます');
	if (kick) {	socket.emit('kick', id); }
}

socket.on('connect', function(evt) {
	getPosition();
	console.log('id:', socket.id);
	console.log('socket.io connected. enter room=' + room);
	console.log('connections:' + getConnectionCount());
	socket.emit('enter', room);
});

socket.on('create room status', function(isExisted, roomname, ansImg) {
	if (!isExisted) {
		var span = document.createElement('span');
					span.innerHTML = ['<img class="thumb" src="', ansImg,
					                  '" title="answer image"/>',
					                  '<== 正解画像'].join('');
					document.getElementById('authImages').insertBefore(span, null);
	}
});

socket.on('id list', function(message) {
	refreshList(message);
});

socket.on('auth question', function(message) {
	console.log('Received Message:', message);
	var count = 0;
	message.forEach( function(img) {
		var span = document.createElement('span');
		span.innerHTML = ['<img class="thumb" src="', img,
						'" title="" id="authImage_', count,'" onclick="selectImage(this)" />'].join('');
		document.getElementById('authImages').insertBefore(span, null);	
		count++;
	});
	
});

socket.on('join', function(message, child) {
	var peerList = document.getElementById('peerList');
	peerList.style.display = "none";
	if (child) {
		var authImages = document.getElementById('authImages');
		authImages.style.display = "none";
	}
	else {
		var sendElement = document.getElementById('sendElement');
		var memberlist = document.getElementById('member');
		sendElement.style.display = "inline";
		memberlist.style.display = "block";
		pickerEnableEvents();
	}
	document.getElementById('yourroom').innerHTML = "You're in <strong>" + escape(message) + "</strong>";
	console.log(message);
	connect();
});

// processing from message-type
socket.on('message', function(message) {
	// console.log('message:', message);
	console.log('message:', message);
	let fromId = message.from;
	if (message.type === 'offer') {
		// --- got offer ---
		console.log('Received offer ...');
		let offer = new RTCSessionDescription(message);
		setOffer(fromId, offer);
	}
	else if (message.type === 'answer') {
		// --- got answer ---
		console.log('Received answer ...');
		let answer = new RTCSessionDescription(message);
		setAnswer(fromId, answer);
	}
	else if (message.type === 'candidate') {
		// --- got ICE Candidate ---
		console.log('Received ICE Candidate ...');
		let candidate = new RTCIceCandidate(message.ice);
		console.log(candidate);
		addIceCandidate(fromId, candidate);
	}
	else if (message.type === 'call me') {
		if (!isReadyToConnect()) {
			console.log('Not ready to connect, so ignore');
			return;
		}
		else if (!canConnectMore()) {
			console.log('TOO MANY connections, so ignore');
		}
		if (isConnectedWith(fromId)) {
			// already connected, so skip
			console.log('already connected, so ignore');
		}
		else if (socket.id !== fromId) {
			// connect new party
			makeOffer(fromId);
		}
		console.log(fromId + "=>" + socket.id);
	}
	else if (message.type === 'bye') {
		if (isConnectedWith(fromId)) {
			stopConnection(fromId);
		}
	}
});

socket.on('user disconnected', function(evt) {
	console.log('====user disconnected==== evt:', evt);
	let id = evt.id;
	if (isConnectedWith(id)) {
		stopConnection(id);
	}
});

socket.on('leave', function(evt) {
	console.log('Disconnected. Reason:', evt);
	location.reload();
});

// --- broadcast message to all members in room
function emitRoom(msg) {
	socket.emit('message', msg);
}

function emitTo(id, msg) {
	msg.sendto = id;
	socket.emit('message', msg);

}

function getRoomname() {
	let url = document.location.href;
	let args = url.split('?');
	if (args.length > 1) {
		let room = args[1];
		if (room != '') {
			return room;
		}
	}
	return 'lobby';
}

// ---- for multi party ----
function isReadyToConnect() {
	if (!localStream) {
		return true;
	}
	else {
		return false;
	}
}

// start PeerConnection
function connect() {
	if (! isReadyToConnect()) {
		console.warn('NOT READY to connect');
	}
	else if (! canConnectMore()) {
		console.log('TOO MANY connections');
	}
	else {
		callMe();
	}
}

// close PeerConnection
function hangUp() {
	emitRoom({ type: 'bye' });  
	stopAllConnection();
}

// ---- multi party --
function callMe() {
	emitRoom({type: 'call me'});
}