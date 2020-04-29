var app = require("express")();
var server = require("http").Server(app);
var accountSid = process.env.ACCOUNT_SID;
var authToken = process.env.AUTH_TOKEN;
var client = require('twilio')(accountSid, authToken);
var formidable = require("formidable");
var neatCsv = require("neat-csv");
var fs = require("fs");
const request = require("request");
const MessagingResponse = require("twilio").twiml.MessagingResponse;
var puppeteer = require("puppeteer");

//screen scrape walmart to get product info
//This method could be used to expand to many other stores that don't have API's
function searchWalmart(term, callback){

  (async() => {


    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto("https://grocery.walmart.com/search/?query=" + term);
    await page.waitForSelector('[data-automation-id=name]');
    await page.focus('[data-automation-id=name]');
    await page.click('[data-automation-id=name]');
    results.push(await page.url());
    callback();
    
    browser.disconnect();


  })();


}

//Kroger API auth info
var krogerId = process.env.KROGER_ID;
var krogerSecret =process.env.KROGER_SECRET;

var results = [];

function makeActualRequest(item, location, callback){

  var settings = {

    url:"https://api.kroger.com/v1/products?filter.term=" + item + "&filter.locationId=" + location,
    method:"get",
    headers:{
      'Accept':"application/json",
      'Authorization':"Bearer " + token
    }


  };
  console.log("GETTING ITEM DATA");
  request(settings, function(err, response, body){
    if (err){
      console.log(err);
    }
    else{
      var objBody = JSON.parse(body)
      for (var i = 0; i < 3; i++){

        var currentItem = objBody.data[i];
        var url = "kroger.com/p/" + currentItem.description + "/" + currentItem.upc;
        url = url.replace(/ /g, "-");
        url = url.replace(/®/g, "");
        url = url.replace(/%/g, "");
        url = url.replace(/™/g, "");
        url = url.replace(/©/g, "");
        if (i == 0){
          results = [];
        }
        results.push(url);
        if (i == 2){
          console.log("RESULTS: " + results);
        }

      }
    }

    searchWalmart(item, callback)
  });


}

var token;
var location;

function getLocation(item, zipCode, callback){


  var options = {
    url:'https://api.kroger.com/v1/locations?filter.zipCode.near=' + zipCode,
    method:"get",
    headers:{
      'Accept':"application/json",
      'Authorization':"Bearer " + token
    }
  };

  request(options, function(error, response, body){

    var jsonBody = JSON.parse(body);
    var id = jsonBody.data[0].locationId;
    makeActualRequest(item, id, callback);

  });

}

function setRequest(item, zipCode, callback){
  const options = {
    url:"https://api.kroger.com/v1/connect/oauth2/token",
    method:"post",
    headers:{
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + new Buffer(krogerId + ":" + krogerSecret).toString("base64"),
      "grant_type":"client_credentials"
    },
    form:{
      "grant_type":"client_credentials",
      "scope":"product.compact"
    }

  }
  request(options, function(err, response, body){

    if (err){
      console.log(err);
    }
    else{
      var jsonRes = JSON.parse(body);
      token = jsonRes.access_token;
      getLocation(item, zipCode, callback);
      //makeActualRequest(item, location);
    }
  });
}




var keywords = [];
fs.readFile("nonFoodWords.csv", async function(err, data){

  var allData = await neatCsv(data);
  for (var i = 0; i < allData.length; i++){
    keywords.push(allData[i].word);
  }

});

var foodDb = [];
fs.readFile("groceryData.csv", async function(err, data){

  var allStuff = await neatCsv(data);
  for (var i = 0; i < allStuff.length; i++){
    foodDb.push(allStuff[i].name);
  }

});

var possiblities;

function checkAgainstDatabase(){
  console.log("possibilities: "+  possibilities);
  var allCounts = [];
  for (var i = 0; i < possibilities.length; i++){
    console.log("current: " + possibilities[i]);
    var currentWord = possibilities[i].toLowerCase();
    var instances = 0;
    console.log("Terms " + foodDb.length);
    for (var a = 0; a < foodDb.length; a++){
      var entry = foodDb[a].toLowerCase();
      if (entry.indexOf(" " + currentWord) != -1 || entry.indexOf(currentWord + " ") != -1){
        if (instances == 0){console.log(entry + " works");}
        instances++;
      }
    }
    console.log("Hits for " + currentWord + ": " + instances);
    allCounts.push(instances);

  }

  var max = 0;
  var bestIndex = 0;
  for (var i = 0; i < allCounts.length; i++){
    if (allCounts[i] > max){
      bestIndex = i;
      max = allCounts[i];
    }
  }

  return possibilities[bestIndex];
}



function getItem(msg){

  //split the sentence into individual words after removing all punctuation
  var parsedMsg = msg.replace(",", "");
  parsedMsg = parsedMsg.replace(".", "");
  parsedMsg = parsedMsg.replace('?', "");
  parsedMsg = parsedMsg.replace("!", "");
  parsedMsg = parsedMsg.replace("'", "");
  parsedMsg = parsedMsg.split(" ");
  var originalArray = msg.replace(",", "");
  originalArray = originalArray.replace(".", "");
  originalArray = originalArray.replace('?', "");
  originalArray = originalArray.replace("!", "");
  originalArray = originalArray.replace("'", "");
  originalArray = originalArray.split(" ");
  /*for (var i = 0; i < parsedMsg.length; i++){
    if (parsedMsg[i] == " " || parsedMsg[i] == ""){
      parsedMsg.splice(i, 1);
      originalArray.splice(i, 1);
      i -= 1;
    }
  }*/
  console.log(parsedMsg + " parsed");

  for (var i = 0; i < parsedMsg.length; i++){
    var currentWord = parsedMsg[i].toLowerCase();
    if (keywords.indexOf(currentWord) != -1){
      parsedMsg.splice(i, 1);
      i -= 1;
    }
  }

  var lastIndex = 0;
  var newArray = [parsedMsg[0]];
  for (var i = 1; i < parsedMsg.length; i++){
    var originalPos = originalArray.indexOf(parsedMsg[i]);
    if (originalPos == originalArray.indexOf(parsedMsg[lastIndex]) + 1){
      newArray.splice(newArray.length - 1, 1);
      newArray.push(parsedMsg[i - 1] +  " " + parsedMsg[i]);
    }
    else{
      newArray.push(parsedMsg[i]);
    }
  }
  possibilities = newArray;



}


app.post("/sms", function(req, res){

  console.log(req.originalUrl + "was the url");

  var form = new formidable.IncomingForm();
  var item;
  form.parse(req, function(err, fields, files){

    var zip = fields.FromZip;
    var msg = fields.Body;
    console.log("*******NEW ORDER*****");
    console.log("Customer says: " + msg);
    var withoutName = msg.replace(/Food Find/g, "");
    withoutName = withoutName.replace(/food find/g, "");
    withoutName = withoutName.replace(/Food find/g, "");
    withoutName = withoutName.replace(/food Find/g, "");
    withoutName = withoutName.replace(/  /g, " ");
    getItem(withoutName);
    item = checkAgainstDatabase();



    console.log(item)

    function sendResponse(){
      if (req.originalUrl.indexOf("?simulator") == -1){
        console.log("Not a simulation");
        var twiml =  new MessagingResponse();
        var message = twiml.message("Here are the best places to get '" + item + "' near you:");
        var newMessage = twiml.message(results[0] + "\n" + "\n" + results[1] + "\n" + "\n" + results[2] + "\n" + "\n" + results[3]);
        res.writeHead(200, {'Content-Type':'text/xml'});
        res.end(twiml.toString());
      }
      else{
        console.log("Hi");
        res.set("Content-Type", "text/html");
        var html;
        var htmlBeginning = "<html><head><link rel='stylesheet' type='text/css' href='externalStyles.css'/><link href='https://fonts.googleapis.com/css2?family=Sen:wght@700&display=swap' rel='stylesheet'></head><body><center><div class='w3-container'>";
        var headString = "Here are the best places to get '" + item + "' near you:" + "</div>";
        var htmlEnd = "</center></body></html>"
        html = htmlBeginning + headString;
        var breaker = "<div class='w3-container buffer'></div>";
        var resultHtml = [];
        for (var i = 0; i < 4; i++){
          resultHtml.push(breaker + "<t>" + results[i] + "</t>");
        }
        html = html + resultHtml[0] + resultHtml[1] + resultHtml[2] + resultHtml[3] + htmlEnd;
        res.send(html);
        res.end();
      }
    }

    setRequest(item, zip, sendResponse);
    //res.send(item);
    //res.end();


  });




});


app.get("/simulator", function(req, res){

  res.sendFile(__dirname + "/simulator.html");



});

app.get("/", function(req, res){
  res.sendFile(__dirname + "/mainpage.html");
});

app.get("/privacy", function(req, res){

  res.sendFile(__dirname + "/privacyPolicy.html");

});

app.get("/support", function(req, res){

  res.sendFile(__dirname + "/foodFindSupport.html");

});

app.get("/:resource", function(req, res){
  var resource = req.params.resource;
  res.sendFile(__dirname + "/" + resource);
});



var port = process.env.PORT;
server.listen(port);
console.log("I started");
