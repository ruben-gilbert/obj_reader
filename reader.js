// Author: Ruben Gilbert
//
// reader.js
//


/**************************************************************
***************************************************************
                    	Main
***************************************************************
**************************************************************/

window.onload = function main() {

	// initialize gl object
	var gl = initialize();

	var dropdown = document.getElementById("dropdown");

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	var file = "./example_OBJs/kat.obj";
	readOBJFile(gl, file);

	// based on dropdown selection, display the .obj file
	dropdown.onchange = function() {
		if (dropdown.value == "bunny") {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			materialData = [];
			var file = "./example_OBJs/bunny.obj";
			readOBJFile(gl, file);
		} else if (dropdown.value == "katarina") {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			materialData = [];
			var file = "./example_OBJs/kat.obj";
			readOBJFile(gl, file);
		} else if (dropdown.value == "muro") {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			materialData = [];
			var file = "./example_OBJs/muro.obj";
			readOBJFile(gl, file);
		} else if (dropdown.value == "thor") {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			materialData = [];
			var file = "./example_OBJs/thor.obj";
			readOBJFile(gl, file);
		} else if (dropdown.value == "werewolf") {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			materialData = [];
			var file = "./example_OBJs/werewolf.obj";
			readOBJFile(gl, file);
		}
	}

}

/**************************************************************
***************************************************************
                    	Initialization
***************************************************************
**************************************************************/

// gl initialization
function initialize() {

    var canvas = document.getElementById('gl-canvas');

    // Use webgl-util.js to make sure we get a WebGL context
    var gl = WebGLUtils.setupWebGL(canvas);

    if (!gl) {
        alert("Could not create WebGL context");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // create our different programs
    //gl.program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.program = initShaders(gl, 'vertex-shader-phong', 'fragment-shader-phong');

    // use this to change which program we use
    gl.useProgram(gl.program);

    gl.u_ModelMatrix =  gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    gl.u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    gl.u_Projection = gl.getUniformLocation(gl.program, 'u_Projection');

    return gl;
}

/**************************************************************
***************************************************************
                    Object File Parsing
***************************************************************
**************************************************************/

// read the object file
function readOBJFile(gl, file) {

	var request = new XMLHttpRequest();

	request.onreadystatechange = function() {

		// if the file is valid and is fetched properly
		if (request.readyState == 4 && request.status == 200) {

			// grab the data from the file
			data = request.responseText;

			// create a new model for this object file
			var obj = new ObjectModel(data, gl);
			display(gl, obj);
		}
	}

	// open the file with the GET protocol
	request.open("GET", file, true);
	request.send();

}

// read a material file, assumes the material file is using rgb format
// and can't handle multiple materials in the same mtl file.  Also is limited in
// what it can read from the file

var materialData = [];

function readMTLFile(file) {

	// return a promise that alters the global variable materialData (prevents
	// asynchronous defects)
	return new Promise(function(resolve, reject) {

		var request = new XMLHttpRequest();

		request.onreadystatechange = function() {

			// if the file is valid and is fetched properly
			if (request.readyState == 4 && request.status == 200) {

				// grab the data from the file
				data = request.responseText;

				var lines = data.split("\n");
				var ambient = [];
				var diffuse = [];
				var specular = [];
				var intensity = 0;

				var ambientFile = "";
				var diffuseFile = "";
				var specularFile = "";

				lines.forEach(function(line) {

					var tokens = line.split(" ");


					// parse the file looking for specific tokens (there are many tokens left out here).
					// this parsing only handles the more simple tokens
					if (tokens[0] == "Ns") {
						intensity = tokens[1];
					} else if (tokens[0] == "Ka") {
						ambient.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
					} else if (tokens[0] == "Kd") {
						diffuse.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
					} else if (tokens[0] == "Ks") {
						specular.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
					} else if (tokens[0] == "map_Ka") {
						ambientFile = tokens[1];
					} else if (tokens[0] == "map_Kd") {
						diffuseFile = tokens[1];
					} else if (tokens[0] == "map_Ks") {
						specularFile = tokens[1];
					}

				});

				// push the tokens into the material data list so we can access them later
				materialData.push(intensity,
									ambient,
									diffuse,
									specular,
									ambientFile,
									diffuseFile,
									specularFile);

				resolve();

			} else if (request.status == 404) {

				// file cound not be read, report error
				reject(Error(file));

			}

		}

		// open the file with the GET protocol
		request.open("GET", file, true);
		request.send();

	})

}

// constructor for object file models.  Parses the file and creates variables
// for all the types of data included in the file
function ObjectModel(data, gl) {

	// temp variables to use in the parsing
	var vertices = [];
	var verticesIndex = [];
	var normals = [];
	var normalsIndex = [];
	var textures = [];
	var texturesIndex = [];
	var name = "";
	var renderType = "";

	var lines = data.split("\n");

	var fixedVertices = [];
	var fixedIndices = [];
	var fixedNormals = [];
	var fixedTextures = [];
	var count = 0;

	var texturesGiven = false;
	var normalsGiven = false;

	var mData = [];

	var selfNormalArray = [];

	// used to adjust the view for a better experience since all models aren't standard size
	var maxY = 0;
	var minY = 0;
	var maxX = 0;
	var minX = 0;

	lines.forEach(function(line) {

		var tokens = line.split(" ");

		// group name
		if (tokens[0] === "g") {

			name = tokens[1];

		}

		// vertex (v)
		else if (tokens[0] === "v") {

			for (var i = 1; i < tokens.length; i++) {

				vertices.push(parseFloat(tokens[i]));

				// check for min/max changes
				if (i == 2 && parseFloat(tokens[i]) > maxY) {

					maxY = parseFloat(tokens[i]);

				} else if (i == 2 && parseFloat(tokens[i]) < minY) {

					minY = parseFloat(tokens[i]);

				} else if (i == 1 && parseFloat(tokens[i]) > maxX) {

					maxX = parseFloat(tokens[i]);

				} else if (i == 1 && parseFloat(tokens[i]) < minX) {

					minX = parseFloat(tokens[i]);

				}
			}

			// make a new available array for vertex
			selfNormalArray.push([]);

		}

		// vertex texture (vt)
		else if (tokens[0] == "vt") {

			for (var i = 1; i < tokens.length; i++) {

				textures.push(parseFloat(tokens[i]));

			}
		}

		// vertex normal (vn)
		else if (tokens[0] == "vn") {

			for (var i = 1; i < tokens.length; i++) {

				normals.push(parseFloat(tokens[i]));

			}
		}

		// point (p) - doesn't work
		else if (tokens[0] === "p") {

			for (var i = 1; i < tokens.length; i++) {

				verticesIndex.push(parseFloat(tokens[i]));

			}

			// set the render type (or output error)
			if (renderType === "") {

				renderType = "points";

			} else if (renderType != "points") {

				// output warning but continue running
				console.log("Conflicting render types in obj file, may cause errors");

			}
		}

		// line (l v1 v2) - doesn't work
		else if (tokens[0] === "l") {

			for (var i = 1; i < tokens.length; i++) {

				verticesIndex.push(parseFloat(tokens[i]));

			}

			// set the render type (or output error)
			if (renderType === "") {

				renderType = "lines";

			} else if (renderType != "lines"){

				// output warning but continue running
				console.log("Conflicting render types in obj file, may cause errors");

			}
		}

		// can handle triangles and quads (which will be split into triangles)
		// takes into account compensation for 1-based indexing in obj file format
		else if (tokens[0] === "f") {

			// determine which face format is being used
			var faceFormat = faceFormatType(tokens);

			if (tokens.length == 4) {			// triangle already specified, no need to convert

					// split the 3 data values based on "/" characters and then
					// read the data depending on what face format the file is using
					var values1 = tokens[1].split("/");
					var values2 = tokens[2].split("/");
					var values3 = tokens[3].split("/");

				if (faceFormat == 0) {			// face (f v1 v2)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					// ----------------------------------------------

					// do calculation for normals since they aren't provided
					var p1 = vec3(vertices[(parseInt(values1[0])-1)*3],
									vertices[(parseInt(values1[0])-1)*3 + 1],
									vertices[(parseInt(values1[0])-1)*3 + 2]);
					var p2 = vec3(vertices[(parseInt(values2[0])-1)*3],
									vertices[(parseInt(values2[0])-1)*3 + 1],
									vertices[(parseInt(values2[0])-1)*3 + 2]);
					var p3 = vec3(vertices[(parseInt(values3[0])-1)*3],
									vertices[(parseInt(values3[0])-1)*3 + 1],
									vertices[(parseInt(values3[0])-1)*3 + 2]);

					var Ux = p2[0] - p1[0];
					var Uy = p2[1] - p1[1];
					var Uz = p2[2] - p1[2];

					var Vx = p3[0] - p1[0];
					var Vy = p3[1] - p1[1];
					var Vz = p3[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values2[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);


				} else if (faceFormat == 1) {	// face with texture (f v1/t1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);

					// push texture indices
					texturesIndex.push(parseInt(values1[1]) - 1);
					texturesIndex.push(parseInt(values2[1]) - 1);
					texturesIndex.push(parseInt(values3[1]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// fix the texture indexing
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					texturesGiven = true;

					// ----------------------------------------------

					// do calculation for normals since they aren't provided
					var p1 = vec3(vertices[(parseInt(values1[0])-1)*3],
									vertices[(parseInt(values1[0])-1)*3 + 1],
									vertices[(parseInt(values1[0])-1)*3 + 2]);
					var p2 = vec3(vertices[(parseInt(values2[0])-1)*3],
									vertices[(parseInt(values2[0])-1)*3 + 1],
									vertices[(parseInt(values2[0])-1)*3 + 2]);
					var p3 = vec3(vertices[(parseInt(values3[0])-1)*3],
									vertices[(parseInt(values3[0])-1)*3 + 1],
									vertices[(parseInt(values3[0])-1)*3 + 2]);

					var Ux = p2[0] - p1[0];
					var Uy = p2[1] - p1[1];
					var Uz = p2[2] - p1[2];

					var Vx = p3[0] - p1[0];
					var Vy = p3[1] - p1[1];
					var Vz = p3[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values2[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);

				} else if (faceFormat == 2) {	// face with normals (f v1//n1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);

					// push normal indices
					normalsIndex.push(parseInt(values1[2]) - 1);
					normalsIndex.push(parseInt(values2[2]) - 1);
					normalsIndex.push(parseInt(values3[2]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// fix the normal indexing
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					normalsGiven = true;

				} else if (faceFormat == 3) {	// face with both (f v1/t1/n1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);

					// push texture indices
					texturesIndex.push(parseInt(values1[1]) - 1);
					texturesIndex.push(parseInt(values2[1]) - 1);
					texturesIndex.push(parseInt(values3[1]) - 1);

					// push normal indices
					normalsIndex.push(parseInt(values1[2]) - 1);
					normalsIndex.push(parseInt(values2[2]) - 1);
					normalsIndex.push(parseInt(values3[2]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// fix the texture indexing
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);

					// fix the normal indexing
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					texturesGiven = true;
					normalsGiven = true;

				} else {

					console.log("Error: File format inconsistent with obj standard");
					error();
					return;

				}

			} else if (tokens.length == 5) {	// quad, need to convert into 2 triangles (0, 1, 2) (0, 2, 3)

				var values1 = tokens[1].split("/");
				var values2 = tokens[2].split("/");
				var values3 = tokens[3].split("/");
				var values4 = tokens[4].split("/");

				if (faceFormat == 0) {			// face (f v1 v2)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);
					verticesIndex.push(parseInt(values4[0]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// 2nd triangle of quad
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					// ----------------------------------------------

					// do calculation for normals since they aren't provided
					var p1 = vec3(vertices[(parseInt(values1[0])-1)*3],
									vertices[(parseInt(values1[0])-1)*3 + 1],
									vertices[(parseInt(values1[0])-1)*3 + 2]);
					var p2 = vec3(vertices[(parseInt(values2[0])-1)*3],
									vertices[(parseInt(values2[0])-1)*3 + 1],
									vertices[(parseInt(values2[0])-1)*3 + 2]);
					var p3 = vec3(vertices[(parseInt(values3[0])-1)*3],
									vertices[(parseInt(values3[0])-1)*3 + 1],
									vertices[(parseInt(values3[0])-1)*3 + 2]);

					var p4 = vec3(vertices[(parseInt(values4[0])-1)*3],
									vertices[(parseInt(values4[0])-1)*3 + 1],
									vertices[(parseInt(values4[0])-1)*3 + 2]);

					var Ux = p2[0] - p1[0];
					var Uy = p2[1] - p1[1];
					var Uz = p2[2] - p1[2];

					var Vx = p3[0] - p1[0];
					var Vy = p3[1] - p1[1];
					var Vz = p3[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values2[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);

					// second face normal
					var Ux = p3[0] - p1[0];
					var Uy = p3[1] - p1[1];
					var Uz = p3[2] - p1[2];

					var Vx = p4[0] - p1[0];
					var Vy = p4[1] - p1[1];
					var Vz = p4[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);
					selfNormalArray[parseInt(values4[0]) - 1].push(N);

				} else if (faceFormat == 1) {	// face with texture (f v1/t1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);
					verticesIndex.push(parseInt(values4[0]) - 1);

					// push texture indices
					texturesIndex.push(parseInt(values1[1]) - 1);
					texturesIndex.push(parseInt(values2[1]) - 1);
					texturesIndex.push(parseInt(values3[1]) - 1);
					texturesIndex.push(parseInt(values4[1]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// 2nd triangle vertices
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 2]);

					// fix the texture indexing
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);

					// 2nd triangle texture
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					texturesGiven = true;

					// ----------------------------------------------

					// do calculation for normals since they aren't provided
					var p1 = vec3(vertices[(parseInt(values1[0])-1)*3],
									vertices[(parseInt(values1[0])-1)*3 + 1],
									vertices[(parseInt(values1[0])-1)*3 + 2]);
					var p2 = vec3(vertices[(parseInt(values2[0])-1)*3],
									vertices[(parseInt(values2[0])-1)*3 + 1],
									vertices[(parseInt(values2[0])-1)*3 + 2]);
					var p3 = vec3(vertices[(parseInt(values3[0])-1)*3],
									vertices[(parseInt(values3[0])-1)*3 + 1],
									vertices[(parseInt(values3[0])-1)*3 + 2]);
					var p4 = vec3(vertices[(parseInt(values4[0])-1)*3],
									vertices[(parseInt(values4[0])-1)*3 + 1],
									vertices[(parseInt(values4[0])-1)*3 + 2]);

					var Ux = p2[0] - p1[0];
					var Uy = p2[1] - p1[1];
					var Uz = p2[2] - p1[2];

					var Vx = p3[0] - p1[0];
					var Vy = p3[1] - p1[1];
					var Vz = p3[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values2[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);

					// second face normal
					var Ux = p3[0] - p1[0];
					var Uy = p3[1] - p1[1];
					var Uz = p3[2] - p1[2];

					var Vx = p4[0] - p1[0];
					var Vy = p4[1] - p1[1];
					var Vz = p4[2] - p1[2];

					var Nx = (Uy*Vz) - (Uz*Vy);
					var Ny = (Uz*Vx) - (Ux*Vz);
					var Nz = (Ux*Vy) - (Uy*Vx);

					var normalize = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);

					var N = vec3(Nx/normalize, Ny/normalize, Nz/normalize);

					selfNormalArray[parseInt(values1[0]) - 1].push(N);
					selfNormalArray[parseInt(values3[0]) - 1].push(N);
					selfNormalArray[parseInt(values4[0]) - 1].push(N);

				} else if (faceFormat == 2) {	// face with normals (f v1//n1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);
					verticesIndex.push(parseInt(values4[0]) - 1);

					// push normal indices
					normalsIndex.push(parseInt(values1[2]) - 1);
					normalsIndex.push(parseInt(values2[2]) - 1);
					normalsIndex.push(parseInt(values3[2]) - 1);
					normalsIndex.push(parseInt(values4[2]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// 2nd triangle vertices
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 2]);

					// fix the normal indexing
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);

					// 2nd triangle normals
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					normalsGiven = true;

				} else if (faceFormat == 3) {	// face with both (f v1/t1/n1)

					// push vertex indices
					verticesIndex.push(parseInt(values1[0]) - 1);
					verticesIndex.push(parseInt(values2[0]) - 1);
					verticesIndex.push(parseInt(values3[0]) - 1);
					verticesIndex.push(parseInt(values4[0]) - 1);

					// push texture indices
					texturesIndex.push(parseInt(values1[1]) - 1);
					texturesIndex.push(parseInt(values2[1]) - 1);
					texturesIndex.push(parseInt(values3[1]) - 1);
					texturesIndex.push(parseInt(values4[1]) - 1);

					// push normal indices
					normalsIndex.push(parseInt(values1[2]) - 1);
					normalsIndex.push(parseInt(values2[2]) - 1);
					normalsIndex.push(parseInt(values3[2]) - 1);
					normalsIndex.push(parseInt(values4[2]) - 1);

					// ----------------------------------------------

					// fix the vertices ordering
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values2[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);

					// 2nd triangle vertices
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values1[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values3[0]) - 1)*3 + 2]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 1]);
					fixedVertices.push(vertices[(parseInt(values4[0]) - 1)*3 + 2]);

					// fix the texture indexing
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values2[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);

					// 2nd triangle textures
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values1[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values3[1]) - 1)*3 + 2]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3 + 1]);
					fixedTextures.push(textures[(parseInt(values4[1]) - 1)*3 + 2]);

					// fix the normal indexing
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values2[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);

					// 2nd triangle normals
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values1[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values3[2]) - 1)*3 + 2]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3 + 1]);
					fixedNormals.push(normals[(parseInt(values4[2]) - 1)*3 + 2]);

					// manage the indices count
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);
					fixedIndices.push(count++);

					texturesGiven = true;
					normalsGiven = true;

				} else {

					console.log("Error: File format inconsistent with obj standard");
					error();
					return;

				}
			}

			// set the render type (or output error)
			if (renderType === "") {
				renderType = "faces";
			} else if (renderType != "faces") {
				// output warning but continue running
				console.log("Conflicting render types in obj file, may cause errors");
			}

		}

		// handle materials if they are provided
		else if (tokens[0] == "mtllib") {

			var materialFile = tokens[1];

			// set up a promise that validates the material data.  Once the
			// data has been received, we can proceed consturcting the texture
			Promise.all(
				[matPromise = readMTLFile(materialFile)]
				)
			.then(function() {

				// if success, allow the data to be used locally
				console.log("materialData", materialData);
				var intensity = materialData[0];
				var ambient = materialData[1];
				var diffuse = materialData[2];
				var specular = materialData[3];
				var ambientFile = materialData[4];
				var diffuseFile = materialData[5];
				var specularFile = materialData[6];

				// NOTE: The way the code is factored prevents these variables
				// from being seen by the buffers later because of the way
				// promises work.  The code completes before the promise completes
				// and these variables are seen.  These variables WOULD be used to
				// pass to uniforms in the shaders to create realistic textures
				// for the corresponding model and the lighting values for which
				// the scene was designed under.  Explained more in summary paper.

			})
			.catch(function(error) {
				alert("Failed to read material data" + error.message);
			});

		}

		else if (tokens[0] == "usemtl") {

			// Unsupported in this app, requires support for groups of vertices

		}

	});

	// if the normals array is empty, we calculate normals.  In the above code,
	// we calculated face normals and stored them in a 2D array corresponding
	// to the vertices that composed the face

	var normalsCreated = false;

	if (normals.length == 0) {

		// calculate normals, these can be directly added to the fixedNormals
		// list because, in the process of calculating face normals, we indexed
		// the normals by the vertex index, solving the problem of mismatching
		// indices

		for (var i = 0; i < selfNormalArray.length; i++) {
			var sumX = 0;
			var sumY = 0;
			var sumZ = 0;

			// summate all the components of each face normal
			for (var j = 0; j < selfNormalArray[i].length; j++) {
				sumX += selfNormalArray[i][j][0];
				sumY += selfNormalArray[i][j][1];
				sumZ += selfNormalArray[i][j][2];
			}

			// average each component
			var avgX = sumX / selfNormalArray[i].length;
			var avgY = sumY / selfNormalArray[i].length;
			var avgZ = sumZ / selfNormalArray[i].length;

			var normalize = Math.sqrt(avgX*avgX + avgY*avgY + avgZ*avgZ);

			// push on the normals
			fixedNormals.push(avgX/normalize);
			fixedNormals.push(avgY/normalize);
			fixedNormals.push(avgZ/normalize);
		}

		// acknowledge we now have normals
		normalsGiven = false;
		normalsCreated = true;

		// also reset fixedVertices to just be normals vertices
		fixedVertices = vertices;

	}

	// cast everything to the proper type of array
	vertices = new Float32Array(vertices);
	verticesIndex = new Uint16Array(verticesIndex);
	normals = new Float32Array(normals);
	normalsIndex = new Uint16Array(normalsIndex);
	textures = new Float32Array(textures);
	texturesIndex = new Uint16Array(texturesIndex);
	fixedVertices = new Float32Array(fixedVertices);
	fixedIndices = new Uint16Array(fixedIndices);
	fixedNormals = new Float32Array(fixedNormals);
	this.name = name;
	this.renderType = renderType;
	this.minY = minY;
	this.maxY = maxY;
	this.maxX = maxX;
	this.minX = minX;

	// load the data into the VBO
    vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
        console.log('Failed to create the buffer object');
        return -1;
    }

	indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
        console.log('Failed to create the index buffer object');
        return -1;
    }

    normalBuffer = gl.createBuffer();
    if (!normalBuffer) {
        console.log('Failed to create the normal buffer object');
        return -1;
    }


    // NOTE: Commenting out Texture Buffer and related data
    // because it is not possible with this implementation to
    // get textures to work properly.

    /*textureBuffer = gl.createBuffer();
    if (!textureBuffer) {
    	console.log('Failed to create the texture buffer object');
        return -1;
    }*/

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    if (normalsGiven || texturesGiven) {
    	gl.bufferData(gl.ARRAY_BUFFER, fixedVertices, gl.STATIC_DRAW);
    } else {
    	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    if (normalsGiven || normalsCreated) {
    	gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    	gl.bufferData(gl.ARRAY_BUFFER, fixedNormals, gl.STATIC_DRAW);
    }

    /*if (texturesGiven) {
    	gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
    	gl.bufferData(gl.ARRAY_BUFFER, fixedTextures, gl.STATIC_DRAW);
    }*/

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    if (normalsGiven) {
    	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fixedIndices, gl.STATIC_DRAW);
    } else {
    	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, verticesIndex, gl.STATIC_DRAW);
    }

    var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    if (a_Position < 0) {
        console.log('Failed to get storage location');
    }

    var a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    if (a_Position < 0) {
        console.log('Failed to get storage location');
    }

    /*var a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
    if (a_Position < 0) {
        console.log('Failed to get storage location');
    }*/

	this.draw = function(gl) {

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Normal);

        /*if (texturesGiven) {
        	gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        }

        gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_TexCoord);*/

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.drawElements(gl.TRIANGLES, fixedIndices.length, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.POLYGON_OFFSET_FILL);

	}

}

// parses the components of the face format structure to determine
// if the face is described with only face, textures, normals, or all
function faceFormatType(tokens) {

	// check the first face description and see if it contains a "/"
	// in it.  If it doesn't, it is just a normal face; if it contains
	// only 1 "/", it is texture data; if it contains more than 1, need
	// to differentiate between just normals and texture AND normals

	if (tokens[1].indexOf("/") == -1) {		// only face data

		return 0;

	} else {	// contains more data

		if (tokens[1].match(/\//g).length == 1) {			// texture data, only 1 "/" found

			return 1;

		} else if (tokens[1].match(/\//g).length == 2) {	// normals or textures AND normals

			// need to differentiate between normals or textures and normals,
			// so we figure out if the 2 "/" characters are right next to one
			// another (meaning only normals) or if there is data between them
			var indices = [];
			var str = tokens[1];
			for (var i = 0; i < str.length; i++) {
				if (str[i] === "/") {
					indices.push(i);
				}
			}

			if (indices[1] - indices[0] == 1) {				// normals only

				return 2;

			} else {										// texture AND normals

				return 3;

			}

		} else {	// error, should not get this if file is structured correctly

			return -1;

		}

	}

}

// error function to be called when an error is encountered
function error() {
	alert("Error found while parsing obj file, see console for more detailed error");
}

/**************************************************************
***************************************************************
                    	Display
***************************************************************
**************************************************************/

function display(gl, obj) {

    // set the perspective projection
    var projection  = perspective(90, 1, .1, 1000);
    gl.uniformMatrix4fv(gl.u_Projection, false, flatten(projection));

    // use the object's max and min values to alter the view matrix
    var imageHeight = obj.maxY - obj.minY;
    var imageWidth = obj.maxX - obj.minX;

    // shift the image down a bit since most obj files start at (0, 0, 0)
    var shift = translate(0, -imageHeight/2, 0);

    var transform = lookAt(vec3(imageWidth/2, imageHeight/2.0, imageHeight*0.75), vec3(0, 0, 0), vec3(0, 1, 0));
    gl.uniformMatrix4fv(gl.u_ViewMatrix, false, flatten(transform));

    var g_last = Date.now();
    var count = 0;
    var angle = 0;
    const ANGLE_STEP = 30;
    var tick = function(){
        // update system
        var now = Date.now();
        var elapsed = now - g_last;
        g_last = now;

        angle = angle + (ANGLE_STEP * elapsed) / 1000.0;

        // load model matrix
        gl.uniformMatrix4fv(gl.u_ModelMatrix, false, flatten(mult(rotate(angle, 0,1,0), shift)));

        // draw system
        gl.clear(gl.COLOR_BUFFER_BIT |gl.DEPTH_BUFFER_BIT);

        obj.draw(gl);

       	requestAnimationFrame(tick);
    };

    tick();
}

// function to initialize a texture image for use in the maze
// NOTE: In this program this function is unused because of the
// way textures are dealt with.  Leaving it for future implementation.
function initializeTexture(gl, textureid, filename, uniform) {

    return new Promise(function(resolve, reject) {

        var texture = gl.createTexture();
        var image = new Image();
        var u_Sampler = gl.getUniformLocation(gl.program, uniform);

        image.onload = function() {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.activeTexture(gl.TEXTURE0 + textureid);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.uniform1i(u_Sampler, textureid);
            resolve();
        }

        image.onerror = function(error) {
            reject(Error(filename));
        }

        image.src = filename;

    })
}
