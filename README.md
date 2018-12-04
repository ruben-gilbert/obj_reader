Simple OBJ file reader.  A couple bugs/oversights.  Probably needs a rewrite.

<img src="https://puu.sh/Ccbmi/be0e520afd.gif" width=640 height=362 alt="kat">

If running locally, you'll need a webserver to be running.

For example, using Python:

```
$ python3 -m http.server
```

Then, assuming your local server is listening to port 8000, visit `http://localhost:8000/reader.html` to load the application.  You may receive an error that a material file cannot be loaded -- you can safely proceed through it.
