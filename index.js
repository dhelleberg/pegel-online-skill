
const Alexa = require('alexa-sdk');
const http = require('http');
const stringSimilarity = require('string-similarity');
var APP_ID = "amzn1.ask.skill.b477c37d-cf6b-4acc-a764-b3a2c2ec7f7b";

const handlers = {
    'LaunchRequest': function () {
        this.attributes.speechOutput = this.t('WELCOME_MESSAGE', this.t('SKILL_NAME'));
        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes.repromptSpeech = this.t('WELCOME_REPROMT');
        this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
    },
    'GetPegel': function () {
        console.log("get pegel request "+JSON.stringify(this.event));
        console.log("get pegel attribs "+JSON.stringify(this.attributes));
        var flussSlot = this.event.request.intent.slots.Fluss;
        var pegelSlot = this.event.request.intent.slots.Pegel;
        var pegel = pegelSlot.value;
        if(!pegel) {
            pegel = this.attributes.fuzzySearchResponse;
            this.attributes.fuzzySearchResponse = undefined;
        }
        
        if(!pegel) {
            this.attributes.speechOutput = this.t('PEGEL_MISSING_RESPONSE');
            this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
            return;
        }
        
        var self = this;
        console.log('incoming request for fluss: '+flussSlot.value+" pegel: "+pegel);
        getPegelData(pegel, function(jsonResponse) {
            console.log('got: '+JSON.stringify(jsonResponse));
            if(jsonResponse.jsonResponse == "error") {
                console.log("could not find pegel, let's try fuzzy search");
                getSimilarPegelName(pegel, function(jsonResponse) {
                    console.log('got: '+JSON.stringify(jsonResponse));
                    if(jsonResponse.jsonResponse == "error") {
                        self.attributes.speechOutput = self.t('UNKNOWN_PEGEL_RESPONSE', pegel);
                        self.emit(':ask', self.attributes.speechOutput, self.attributes.repromptSpeech);
                        return;
                    }
                    else {
                        var pegelName;
                        var allNames = new Array();
                        var lastDist = 100;
                        for(var i=0, len=jsonResponse.jsonResponse.length; i<len; i++) {
                            allNames[i] = jsonResponse.jsonResponse[i].shortname;
                            //console.log("dist from "+pegel + " and "+jsonResponse.jsonResponse[i].shortname+ " is "+dist);
                            /*if(dist < lastDist) {
                                pegelName = jsonResponse.jsonResponse[i].shortname;
                                lastDist = dist;
                            } */                           
                        }
                        pegelName = stringSimilarity.findBestMatch(pegel, allNames).bestMatch.target;
                        self.attributes.speechOutput = self.t('FUZZY_PEGEL_RESPONSE',pegel, pegelName);
                        self.attributes.fuzzySearchResponse = pegelName;
                        self.emit(':tell', self.attributes.speechOutput);
                    }
                });
            }
            else {
                var tendenz = "unbekannt";
                if(jsonResponse.jsonResponse.trend === -1)
                    tendenz = "fallend";
                if(jsonResponse.jsonResponse.trend ===  1)
                    tendenz = "steigend";
                if(jsonResponse.jsonResponse.trend ===  0)
                    tendenz = "konstant";
                
                if(!flussSlot.value)    
                    self.attributes.speechOutput = self.t('PEGEL_RESPONSE_SHORT', pegel, jsonResponse.jsonResponse.value, tendenz);
                else
                    self.attributes.speechOutput = self.t('PEGEL_RESPONSE', pegel, flussSlot.value, jsonResponse.jsonResponse.value, tendenz);
                self.emit(':tell', self.attributes.speechOutput);
            }
        });
    },
    'AMAZON.StopIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'AMAZON.NoIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest':function () {
        this.emit(':tell', this.t("STOP_MESSAGE"));
    }
}

function getPegelData(pegelName, callback) {
        url = encodeURI('/webservices/rest-api/v2/stations/'+pegelName+'/W/currentmeasurement.json');
        console.log("url: "+url);
        http.get({
            host: 'www.pegelonline.wsv.de',
            encoding: "utf8",
            path: url
        }, function(response) {
            // Continuously update stream with data
            console.log("response: "+response+ "code: "+response.statusCode)
            if(response.statusCode != 200) {
                callback({
                    jsonResponse: "error"
                });
                return;
            } 
            var body = '';
            response.on('data', function(d) {
                body += d;
            });
            response.on('end', function() {
                // Data reception is done, do whatever with it!
                console.log("respone "+body);
                var jsonResponse = JSON.parse(body);
                
                callback({
                    jsonResponse: jsonResponse
                });
            });
        });
}

function getSimilarPegelName(pegelName, callback) {
        url = encodeURI('/webservices/rest-api/v2/stations.json?fuzzyId='+pegelName);
        console.log("url: "+url);
        http.get({
            host: 'www.pegelonline.wsv.de',
            encoding: "utf8",
            path: url
        }, function(response) {
            // Continuously update stream with data
            console.log("response: "+response+ "code: "+response.statusCode)
            if(response.statusCode != 200) {
                callback({
                    jsonResponse: "error"
                });
                return;
            } 
            var body = '';
            response.on('data', function(d) {
                body += d;
            });
            response.on('end', function() {
                // Data reception is done, do whatever with it!
                console.log("respone "+body);
                var jsonResponse = JSON.parse(body);
                if(jsonResponse.length === 0) {
                    callback({
                        jsonResponse: "error"
                    });
                }
                else {
                    callback({
                        jsonResponse: jsonResponse
                    });
                }
            });
        });


}



const languageStrings = {
    'de-DE': {
        translation: {
            SKILL_NAME: 'Pegel Online',
            WELCOME_MESSAGE: 'Willkommen bei %s. Frag zum Beispiel: Sag mit den Pegel bei Köln?',
            PEGEL_RESPONSE: 'Der Pegel bei %s am %s ist %s cm tendenz %s',
            PEGEL_RESPONSE_SHORT: 'Der Pegel bei %s ist %s cm tendenz %s',
            UNKNOWN_PEGEL_RESPONSE: 'Ich konnte für den Pegel %s keinen Wert ermitteln.',
            PEGEL_MISSING_RESPONSE: 'Ich konnte den gewünschten Pegel nicht verstehen, bitte versuche es noch einmal.',
            FUZZY_PEGEL_RESPONSE: 'Ich konnte den Pegel %s nicht finden meintest Du vielleicht %s?',
            WELCOME_REPROMT: 'Wenn du wissen möchtest, was du sagen kannst, sag einfach „Hilf mir“.',
            STOP_MESSAGE: 'Auf Wiedersehen!'
        }
    }
}
            

exports.handler = (event, context, callback) => {
    // TODO implement
    console.log("event = " + event);    
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
