/**
 * ES6规范的Promise
 * 仅用于测试和学习
 * 目前仅在node环境中测试通过
 */
(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    var State;
    (function (State) {
        State[State["PENDING"] = 0] = "PENDING";
        State[State["FULFILLED"] = 1] = "FULFILLED";
        State[State["REJECTED"] = 2] = "REJECTED";
    })(State || (State = {}));
    var MinimalPromise = (function () {
        function MinimalPromise(fn) {
            this.handlers = []; //该promise解决后需要执行的回调处理函数列表（index为偶数代表onFulfilled，奇数代表onRejected）
            if ('function' !== typeof fn) {
                throw new TypeError('Supplied parameter should be callable.');
            }
            //不允许多次初始化（比如使用MinimalPromise.call(promise, function(){})）
            if (undefined !== this.state) {
                throw new TypeError('Cant\'t reconstruct a exist promise.');
            }
            //初始化
            this.state = State.PENDING;
            //立即执行
            this.resolveTask(fn);
        }
        //立即执行任务函数
        MinimalPromise.prototype.resolveTask = function (fn) {
            var _this = this;
            var done = false; //确保仅被解决一次
            try {
                fn(function (result) {
                    if (done) {
                        return;
                    }
                    done = true;
                    // this.resolve(result);
                    MinimalPromise.nextTick(function () { return _this.resolve(result); }); //放到下一个事件循环中执行（此举在于支持promise被立即解决后，在当前代码段(当前事件循环)中，还可在后面继续添加then操作）
                }, function (error) {
                    if (done) {
                        return;
                    }
                    done = true;
                    _this.reject(error);
                });
            }
            catch (err) {
                if (done) {
                    return;
                }
                this.reject(err);
            }
        };
        //尝试使用一个结果值来完成此promise，若结果值是promise，则会等待其完成后解决此promise
        MinimalPromise.prototype.resolve = function (result) {
            if (MinimalPromise.isThenable(result)) {
                result.then(this.fulfill.bind(this), this.reject.bind(this));
            }
            else {
                this.fulfill(result);
            }
        };
        /**
         * 标记当前promise已解决，并执行回调处理函数
         *
         * @param {boolean} fulfilled 是否标记为fulfilled状态，否则为rejected
         * @param {*} value 成功完成后的结果值或失败后的错误值
         *
         * @memberOf MinimalPromise
         */
        MinimalPromise.prototype.complete = function (fulfilled, value) {
            this.state = fulfilled ? State.FULFILLED : State.REJECTED;
            this.value = value;
            for (var i = 0, gap = fulfilled ? 0 : 1, handlers = this.handlers, len = handlers.length; i < len; i += 2) {
                var handler = handlers[i + gap];
                if ('function' === typeof handler) {
                    handler(this.value);
                }
            }
            this.handlers = null; //清空以便GC
        };
        MinimalPromise.prototype.fulfill = function (result) { this.complete(true, result); };
        MinimalPromise.prototype.reject = function (error) { this.complete(false, error); };
        //添加一个结果回调（同其他库的done）
        MinimalPromise.prototype.addHandler = function (onFulfilled, onRejected) {
            var _this = this;
            MinimalPromise.nextTick(function () {
                if (_this.state === State.PENDING) {
                    _this.handlers.push(onFulfilled, onRejected);
                }
                else if (_this.state === State.FULFILLED) {
                    if ('function' === typeof onFulfilled) {
                        onFulfilled(_this.value);
                    }
                }
                else if (_this.state === State.REJECTED) {
                    if ('function' === typeof onRejected) {
                        onRejected(_this.value);
                    }
                }
            });
        };
        //then方法的目的在于返回一个新的promise，该promise的任务函数的作用在于监听当前promise的完成事件，当前promise完成后，会继续去完成新promise
        MinimalPromise.prototype.then = function (onFulfilled, onRejected) {
            var _this = this;
            MinimalPromise.checkBadInstance(this);
            return new MinimalPromise(function (resolve, reject) {
                //监听当前promise的成功和失败事件
                _this.addHandler(function (result) {
                    if ('function' === typeof onFulfilled) {
                        try {
                            resolve(onFulfilled(result)); //执行onFulfilled函数并用其结果值来解决新promise(若结果值是promise，同上面一样，会先等待其完成后，才完成此新promise)
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else {
                        resolve(result);
                    }
                }, function (error) {
                    if ('function' === typeof onRejected) {
                        try {
                            resolve(onRejected(error)); //向后[传递]，以便可被后续then拦截
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else {
                        reject(error);
                    }
                });
            });
        };
        //catch方法与then类似，区别在于它仅监听reject(失败)事件
        MinimalPromise.prototype.catch = function (onRejected) {
            return this.then(null, onRejected);
        };
        //某对象是否是promise
        MinimalPromise.isThenable = function (thenable) {
            return 'object' === typeof thenable && 'function' === typeof thenable.then;
        };
        MinimalPromise.resolve = function (result) {
            this.checkBadClass(this);
            if (this.isThenable(result)) {
                return result;
            }
            return new this(function (resolve) { return resolve(result); });
        };
        MinimalPromise.reject = function (error) {
            this.checkBadClass(this);
            return new this(function (resolve, reject) { return reject(error); });
        };
        MinimalPromise.defer = function () {
            var defer = { resolve: null, reject: null, promise: null };
            defer.promise = new this(function (resolve, reject) {
                defer.resolve = resolve;
                defer.reject = reject;
            });
            return defer;
        };
        MinimalPromise.all = function (iterable) {
            this.checkBadClass(this);
            if (!this.isIterable(iterable)) {
                return this.reject(new TypeError('Supplied parameter should be iterable.'));
            }
            if (!iterable.length) {
                return this.resolve([]);
            }
            var values = [], resolvedNum = 0, completed = false, total = iterable.length, defer = this.defer(), complete = function (index, value, isError) {
                if (isError === void 0) { isError = false; }
                if (!completed) {
                    if (isError) {
                        completed = true;
                        defer.reject(value);
                    }
                    else {
                        values[index] = value;
                        if (++resolvedNum >= total) {
                            completed = true;
                            defer.resolve(values);
                        }
                    }
                }
            };
            var _loop_1 = function(i) {
                var thenable = iterable[i];
                if (this_1.isThenable(thenable)) {
                    thenable.then(function (result) { return complete(i, result); }, function (error) { return complete(i, error, true); });
                }
                else {
                    complete(i, thenable);
                }
            };
            var this_1 = this;
            for (var i = 0; i < total && !completed; i++) {
                _loop_1(i);
            }
            return defer.promise;
        };
        MinimalPromise.race = function (iterable) {
            var _this = this;
            this.checkBadClass(this);
            if (!this.isIterable(iterable)) {
                return this.reject(new TypeError('Supplied parameter should be iterable.'));
            }
            // if (!iterable.length) { return this.resolve(); } //若是空数组，则后面直接返回的是pending的promise
            return new MinimalPromise(function (resolve, reject) {
                for (var _i = 0, iterable_1 = iterable; _i < iterable_1.length; _i++) {
                    var value = iterable_1[_i];
                    _this.resolve(value).then(resolve, reject);
                }
            });
        };
        //若非标准constructor或instance，则报错
        MinimalPromise.checkBadClass = function (cls) {
            if (cls !== MinimalPromise) {
                throw new TypeError('Bad promise constructor.');
            }
        };
        MinimalPromise.checkBadInstance = function (inst) {
            if (inst.constructor !== MinimalPromise) {
                throw new TypeError('Bad promise instance.');
            }
        };
        //是否是可遍历的对象（用于all()）
        MinimalPromise.isIterable = function (iterable) {
            // if (null === iterable || undefined === iterable) { return false; }
            // return 'function' === typeof iterable[Symbol.iterator]; // NEED es6
            // return Array.isArray(iterable);
            return '[object Array]' === Object.prototype.toString.call(iterable);
        };
        //在下一个event loop中执行某函数
        MinimalPromise.nextTick = function (fn) {
            //node环境
            process.nextTick(fn);
            //other TODO
        };
        return MinimalPromise;
    }());
    exports.Promise = MinimalPromise;
    exports.__esModule = true;
    exports["default"] = MinimalPromise;
});
