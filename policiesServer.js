var app = require("express")();
var server = require("http").Server(app);

app.get("/privacy", function(req, res){
  res.sendFile(__dirname + "/privacyPolicy.html");
});

app.get("/terms", function(req, res){
  res.sendFile(__dirname + "/termsConditions.html");
});

app.get("/", function(req, res){
  res.sendFile(__dirname + "/termsConditions.html");
});

app.get("/:resource", function(req, res){
  var resource = req.params.resource;
  res.sendFile(__dirname + "/" + resource);
});

var port = process.env.PORT;
server.listen(port);
