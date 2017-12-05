var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var url = process.env.MONGOLAB_URI;
var urlParse = require('url');
var ping = require('net-ping');
var request = require('request');
var validUrl = require('valid-url');


app.disable('x-powered-by');
app.set('port', process.env.Port || 3000);
app.use(express.static(__dirname + '/public'));

var addUrl = function(db, original, callback) {
  var key = +(Math.floor((Math.random() * 9000) + 1000));
  console.log(key);
  var collection = db.collection('shortUrls');
  collection.insert({
    longUrl: original,
    shortUrl: key
  }, function(err, result) {
    assert.equal(err, null);
    callback(result);
  });
}

var referenceShortUrl = function(db, short, callback) {
  var shortNum = +short;
  var collection = db.collection('shortUrls');
  collection.find({
    'shortUrl': shortNum
  }).toArray(function(err, docs) {
    if (docs.length > 0) {
      callback(docs);
    }
    else {
      var err = new Error("No reference to shortened URL /" + short + " exists");
      callback(docs, err)
    }
  });
}

var getAllUrls = function(db, callback) {
  var collection = db.collection('shortUrls');
  collection.find({}).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found:");
    console.log(docs);
    callback(docs);
  });
}

var checkForExisting = function(input, db, callback) {
  var collection = db.collection('shortUrls');
  collection.find({
    'longUrl': input
  }).toArray(function(err, docs) {
    if (err) {
      console.log(err);
    }
    else {
      callback(docs);
    }
  });
}

var urlChecker = function(input, callback) {
  if (validUrl.isHttpUri(input) || validUrl.isHttpsUri(input) && input.indexOf('www.') > -1) {
    var parsed = urlParse.parse(input);
    var host = parsed.hostname;
    console.log(host);
    var options = {
      url: "http://" + host,
      method: 'HEAD'
    }
    request(options, function(error, response) {
      if (error) {
        options = {
          url: "http://" + host,
          method: 'GET'
        };
        request(options, function(error, response) {
          if (response.statusCode == 200) {
            callback(input, err);
          }
          else {
            console.log(response.status);
            var err = new Error("The provided URL: '" + options.url + "' could not be found, please provide a URL for a real website.");
            err.status = response.status;
            callback(input, err);
          }
        });
      }
      else {
        console.log('It\'s a good URL');
        callback(input, err);
      }
    });
  }
  else {
    var err = new Error("Invalid URL Format. Please provide a URL for a real website in the proper format.");
    err.status = 404;
    callback(input, err);
  }
}


app.get('/', function(req, res) {
  res.render('index');
})


app.get('/all', function(req, res) {
  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connection Established");
    getAllUrls(db, function() {
      db.close();
    });
  });
})


app.get('/shorten/*', function(req, res) {
  var path = req.path;
  var original = path.slice(9);
  urlChecker(original, function(result, err) {
    if (err) {
      res.json({
        "Error": err.message
      });
    }
    else {
      var resObj;
      MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        checkForExisting(original, db, function(result) {
          if (result.length > 9) {
            var randomExisting = Math.floor(Math.random() * 10);
            console.log("Maximum entries for " + original + " hit.  Grabbing instance #", randomExisting)
            resObj = {
              "Original URL": result[randomExisting].longUrl,
              "Shortened URL": "https://url-shortener-microservice-fcc.glitch.me/" + result[randomExisting].shortUrl
            };
            db.close();
            res.json(resObj);
          }
          else {
            addUrl(db, original, function(result) {
              var long = result.ops[0].longUrl;
              var short = result.ops[0].shortUrl;
              resObj = {
                "Original URL": long,
                "Shortened URL": "https://url-shortener-microservice-fcc.glitch.me/" + short
              };
              db.close();
              res.json(resObj);
            });
          }
        });
      });
    }
  });
})

app.get('/:shortUrl', function(req, res) {
  var short = req.params.shortUrl;
  MongoClient.connect(url, function(err, db) {
    referenceShortUrl(db, short, function(docs, error) {
      if (error) {
        res.json({
          "Error": error.message
        });
        db.close();
      }
      else {
        console.log(docs);
        var redirectUrl = docs[0].longUrl;
        console.log(redirectUrl);
        res.redirect(redirectUrl);
        db.close();
      }
    });
  });
})


app.listen(app.get('port'), function() {
  console.log("Listening");
});
