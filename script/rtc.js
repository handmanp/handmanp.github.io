	// --- RTCPeerConnections ---

	let localStream = null;
	// ---- for multi party ----
	let peerConnections = [];
	let channel = [];
	const MAX_CONNECTION_COUNT = 3;

	// --- prefix -----
  	navigator.getUserMedia  = navigator.getUserMedia    || navigator.webkitGetUserMedia ||
		  navigator.mozGetUserMedia || navigator.msGetUserMedia;

	RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

	RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription ||
		window.mozRTCSessionDescription;

	function _assert(desc, v) {
			if (v) {
				return;
			}
			else {
				let caller = _assert.caller || 'Top level';
				console.error('ASSERT in %s, %s is :', caller, desc, v);
			}
		}

	function getConnectionCount() {
		return peerConnections.length;
	}
	
	function canConnectMore() {
		return (getConnectionCount() < MAX_CONNECTION_COUNT);
	}
	
	function isConnectedWith(id) {
		if (peerConnections[id]) {
			return true;
		}
		else {
			return false;
		}
	}


	function addConnection(id, peer) {
		_assert('addConnection() peer', peer);
		_assert('addConnection() must NOT EXIST', (!peerConnections[id]));
		
		// データチャネルを生成
		console.log('set datachannel:' + id, peer);
		//channel[id] = setDataChannel(peer);

		peer.ondatachannel = function(evt) {
			console.log('ondatachannel with' + id, evt);
			let dataChannel = evt.channel;

			dataChannel.onopen = (evt) => {
				console.log('DataChannel onopen', evt);
			}

			dataChannel.onmessage = (evt) => {
				console.log('DataChannel onmessage:', evt);
				var span = document.createElement('span');
					span.innerHTML = ['<img class="thumb" src="', evt.data,
					                  '" title="', escape('image'), '"/>'].join('');
				document.getElementById('list').insertBefore(span, null);
			}

			dataChannel.onerror = (evt) => {
				console.log('DataChannel onerror', evt);
			}
			console.log('ondatachannel with ' + id, evt);

			channel[id] = dataChannel;

			console.log('channel ' + id + ':', channel[id]);

		};

		peerConnections[id] = peer;

	}

	function getConnection(id) {
		let peer = peerConnections[id];
		_assert('getConnection() peer must exit', peer);
		return peer;
	}

	function deleteConnection(id) {
		_assert('deleteConnection() peer must exist', peerConnections[id]);
		delete peerConnections[id];
	}

	function stopConnection(id) {
		detachVideo(id);
		if (isConnectedWith(id)) {
			let peer = getConnection(id);
			peer.close();
			deleteConnection(id);
		}
	}

	function stopAllConnection() {
		for (let id in peerConnections) {
			stopConnection(id);
		}
	}

	function sendSdp(id, sessionDescription) {
		console.log('---sending sdp ---');
		/*---
		textForSendSdp.value = sessionDescription.sdp;
		textForSendSdp.focus();
		textForSendSdp.select();
		----*/
		let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
		console.log('sending SDP=' + message);
		//ws.send(message);
		//emitTo(id, message);
		emitRoom(message);
	}

	function sendIceCandidate(id, candidate) {
		console.log('---sending ICE candidate ---');
		let obj = { type: 'candidate', ice: candidate };
		//let message = JSON.stringify(obj);
		//console.log('sending candidate=' + message);
		//ws.send(message);
		if (isConnectedWith(id)) {
			emitTo(id, obj);
		}
		else {
			console.warn('connection NOT EXIST or ALREADY CLOSED. so skip candidate')
		}
	}

	function prepareNewConnection(id) {
		let pc_config = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};
		let peer = new RTCPeerConnection(pc_config);
		// ... 449 - 471

		// --- on get local ICE candidate
		// http://zoo-of-blue-and-red.blogspot.com/2014/08/webrtcrtcdatachannel-api.html
		// Bind peerconnection to Remote Datachannel
		peer.ondatachannel = function(evt) {

			let dataChannel = evt.channel;

			dataChannel.onopen = (evt) => {
				console.log('DataChannel onopen', evt);
			}

			dataChannel.onmessage = (evt) => {
				console.log('DataChannel onmessage:', evt);
				var span = document.createElement('span');
					span.innerHTML = ['<img class="thumb" src="', evt.data,
					                  '" title="', escape('image'), '"/>'].join('');
				document.getElementById('list').insertBefore(span, null);
			}

			dataChannel.onerror = (evt) => {
				console.log('DataChannel onerror', evt);
			}
			console.log('ondatachannel with ' + id, evt);
			channel[id] = dataChannel;

			console.log('channel ' + id + ':', channel[id]);
		}

		peer.onicecandidate = function(evt) {
			if (evt.candidate) {
				console.log(evt.candidate);

				sendIceCandidate(id, evt.candidate);
			}
			else {
				console.log('empty ice event');
			}
		};

		peer.negotiationneeded = function(evt) {
			console.log('-- onnegotiationneeded --');
		};

		peer.onsignalingstatechange = function() {
			console.log('== signaling status=' + peer.signalingState);
		};

		peer.oniceconnectionstatechange = function() {
			console.log('== ice connection status=' + peer.iceConnectionState);
			if (peer.iceConnectionState === 'disconnected') {
				console.log('-- disconnected --');
				//hangUp();
				stopConnection(id);
			}
		};

		peer.onicegatheringstatechange = function() {
			console.log('==***== ice gathering state=' + peer.iceGatheringState);
		};
		
		peer.onconnectionstatechange = function() {
			console.log('==***== connection state=' + peer.connectionState);
		};

		peer.onremovestream = function(event) {
			console.log('-- peer.onremovestream()');
			//pauseVideo(remoteVideo);
			deleteRemoteStream(id);
			detachVideo(id);
		};

		// -- add local stream --
		if (localStream) {
			console.log('Adding local stream...');
			peer.addStream(localStream);
		}
		else {
			console.warn('no local stream, but continue.');
		}

		return peer;
	}

	function makeOffer(id) {
		_assert('makeOffer must not connected yet', (! isConnectedWith(id)) );
		peerConnection = prepareNewConnection(id);
		addConnection(id, peerConnection);
		channel[id] = setDataChannel(peerConnection);
		peerConnection.createOffer()
		.then(function (sessionDescription) {
			console.log('makeOffer() succsess in promise');
			return peerConnection.setLocalDescription(sessionDescription);
		}).then(function() {
			console.log('setLocalDescription() succsess in promise');
			// -- Trickle ICE の場合は、初期SDPを相手に送る -- 
			sendSdp(id, peerConnection.localDescription);
			// -- Vanilla ICE の場合には、まだSDPは送らない --
		}).catch(function(err) {
			console.error(err);
		});
	}

	function setOffer(id, sessionDescription) {
		_assert('setOffer must not connected yet', (! isConnectedWith(id)) );    
		let peerConnection = prepareNewConnection(id);
		addConnection(id, peerConnection);

		peerConnection.setRemoteDescription(sessionDescription)
		.then(function() {
			console.log('setRemoteDescription(offer) succsess in promise');
			makeAnswer(id);
		}).catch(function(err) {
			console.error('setRemoteDescription(offer) ERROR: ', err);
		});
	}
	
	function makeAnswer(id) {
		console.log('sending Answer. Creating remote session description...' );
		let peerConnection = getConnection(id);
		if (! peerConnection) {
			console.error('peerConnection NOT exist!');
			return;
		}
		
		peerConnection.createAnswer()
		.then(function (sessionDescription) {
			console.log('createAnswer() succsess in promise');
			return peerConnection.setLocalDescription(sessionDescription);
		}).then(function() {
			console.log('setLocalDescription() succsess in promise');
			// -- Trickle ICE の場合は、初期SDPを相手に送る -- 
			sendSdp(id, peerConnection.localDescription);
			// -- Vanilla ICE の場合には、まだSDPは送らない --
		}).catch(function(err) {
			console.error(err);
		});
	}
	function setAnswer(id, sessionDescription) {
		let peerConnection = getConnection(id);
		if (! peerConnection) {
			console.error('peerConnection NOT exist!');
			return;
		}
		peerConnection.setRemoteDescription(sessionDescription)
		.then(function() {
			console.log('setRemoteDescription(answer) succsess in promise');
		}).catch(function(err) {
			console.error('setRemoteDescription(answer) ERROR: ', err);
		});

	}
	// --- tricke ICE ---
	function addIceCandidate(id, candidate) {
		if (! isConnectedWith(id)) {
			console.warn('NOT CONNEDTED or ALREADY CLOSED with id=' + id + ', so ignore candidate');
			return;
		}
		
		let peerConnection = getConnection(id);
		if (peerConnection) {
			peerConnection.addIceCandidate(candidate);
		}
		else {
			console.error('PeerConnection not exist!');
			return;
		}
	}

	function setDataChannel(peer) {
		let dataChannel = peer.createDataChannel("chat");
		
		dataChannel.onopen = (evt) => {
			console.log('DataChannel onopen', evt);
		}

		dataChannel.onmessage = (evt) => {
			console.log('DataChannel onmessage:', evt);
			var span = document.createElement('span');
					span.innerHTML = ['<img class="thumb" src="', evt.data,
					                  '" title="', escape('image'), '"/>'].join('');
			document.getElementById('list').insertBefore(span, null);
		}

		dataChannel.onerror = (evt) => {
			console.log('DataChannel onerror', evt);
		}
		return dataChannel;
	}