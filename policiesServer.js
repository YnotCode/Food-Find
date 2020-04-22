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


server.listen(5700);
