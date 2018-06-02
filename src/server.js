import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import botkit from 'botkit';
import dotenv from 'dotenv';
import yelp from 'yelp-fusion';

dotenv.config({ silent: true });


// initialize
const app = express();
// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// hello response
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  // bot.reply(message, 'Hello there!');
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// when it doesn't know what user is talking about
controller.on('direct_message', (bot, message) => {
  bot.reply(message, 'I am sorry. What are you talking about?');
});
// when you mention the slack bot it will say hello
controller.on('direct_mention', (bot, message) => {
  bot.reply(message, 'helloooo');
});

controller.hears(['help'], ['direct_message', 'direct_mention'], (bot, message) => {
  // bot.reply(message, 'Hello there!');
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, 'I can give you food reccomendations and say hello using your name :)');
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});


let foodType = '';
let location = '';

// Yelp food reccomendations
controller.hears(['hungry'], ['direct_message', 'direct_mention'], (bot, message) => {
  bot.startConversation(message, foodRec);
});

function foodRec(response, convo) {
  convo.ask('Do you want food reccomendations in a certain location?', (response, convo) => {
    convo.say('I will give you food recs!');
    findWhere(response, convo);
    convo.next();
  });
}

function findWhere(response, convo) {
  convo.ask('Where are you?', (response, convo) => {
    convo.say('I love that place!');
    location = response.text;
    whatFood(response, convo);
    convo.next();
  });
}

function whatFood(response, convo) {
  convo.ask('What kind of food would you like?', (response, convo) => {
    foodType = response.text;
    convo.say('Yummy!');
    convo.say('I am finding food places in that area...');
    findFood(foodType, location, convo);
    convo.next();
  });
}

function findFood(food, location, convo) {
  const yelpClient = yelp.client(process.env.YELP_CLIENT_SECRET);
  yelpClient.search({
    term: food,
    location,
  }).then((response) => {
    response.jsonBody.businesses.forEach((business) => {
      const foodResults = {
        attachments: [
          {
            fallback: 'no results',
            pretext: `rating: ${business.rating}`,
            title: business.name,
            title_link: business.url,
            image_url: business.image_url,
          },
        ],
      };
      convo.say(foodResults);
      convo.next();
    });
  }).catch((e) => {
    convo.say('Sorry, no results!');
    convo.next();
  });
}

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'hello I am here');
});

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
// const port = process.env.PORT || 9090;
// app.listen(port);
//
// console.log(`listening on: ${port}`);
