# MinimalPromise [![Build Status](https://travis-ci.org/wilsoncook/minimal-promise.svg?branch=master)](https://travis-ci.org/wilsoncook/minimal-promise)
A minimalist promise that follows the behaves of ES6 Promise specifications.   
Testing under [promises-es6-tests](https://github.com/promises-es6/promises-es6) cases.  
(It is recommended to used as demonstrations or personal learning)  
  
## Installation
```js
npm install minimal-promise
```
  
## Usage
```js
import { Promise } from 'minimal-promise'; //Typescript style
//var Promise = require('minimal-promise').Promise; //node style

//Normal usage
new Promise(function(resolve, reject) {
    setTimeout(function() { resolve('OK'); }, 1000);
}).then(function(result) {
    console.log('result is: ', result);
}).catch(function() {
    //TODO
});

//Static methods
Promise.resolve('test'); //make a immediately resolved promise
Promise.reject(new Error('test')); //make a immediately  rejected promise
Promise.defer(); //return a defered object
Promise.all([5, new Promise(function() {}), 'other']);
Promise.race(['first', 'second', Promise.resolve('third')]);
```

## TODO
* Test under browsers && PromiseA+ test cases.
