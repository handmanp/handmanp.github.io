var URL_BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
var elDrop = document.getElementById('dropzone');
var elFiles = document.getElementById('selectedfiles');
var files;

function pickerEnableEvents() {
	elDrop.addEventListener('dragover', function(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		showDropping();
	});

	elDrop.addEventListener('dragleave', function(event) {
		hideDropping();
	});

	elDrop.addEventListener('drop', function(event) {
		event.preventDefault();
		hideDropping();
		files = event.dataTransfer.files;
		showFiles(files);
	});

	elDrop.addEventListener('click', async function(event) {
		var evt = await showOpenFileDialog();
			files = evt;
			showFiles(files);
	});
}

const showOpenFileDialog = () => {
	return new Promise(resolve => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*,.png,.jpg,.jpeg,.gif';
		input.multiple = 'multiple';
		input.onchange = event => { resolve(event.target.files); };
		input.click();
	});
}

function showDropping() {
		elDrop.classList.add('dropover');
}

function hideDropping() {
		elDrop.classList.remove('dropover');
}

function showFiles(files) {
		handleFileSelect(files);
}

function buildElFile(file) {
		var elFile = document.createElement('li');
		var text = file.name + ' (' + file.type + ',' + file.size + 'bytes)';
		elFile.appendChild(document.createTextNode(text));
		if (file.type.indexOf('image/') === 0) {
			var elImage = document.createElement('img');
			elImage.src = URL_BLANK_IMAGE;
			elFile.appendChild(elImage);
			attachImage(file, elImage);
		}
		return elFile;
}
function attachImage(file, elImage) {
	var reader = new FileReader();
	reader.onload = function(event) {
		var src = event.target.result;
		elImage.src = src;
		elImage.setAttribute('title', file.name);
	};
	reader.readAsDataURL(file);
}
function escapeHtml(source) {
	var el = document.createElement('div');
	el.appendChild(document.createTextNode(source));
	var destination = el.innerHTML;
	return destination;
}