/**
 * ES6规范的Promise
 * 仅用于测试和学习
 * 目前仅在node环境中测试通过
 */

enum State { PENDING = 0, FULFILLED = 1, REJECTED = 2 }

class MiniPromise {

	private state: State;
	private value: any; //该promise解决后(resolve或reject)的结果值
	private handlers: (Function|null|undefined)[] = []; //该promise解决后需要执行的回调处理函数列表（index为偶数代表onFulfilled，奇数代表onRejected）

	constructor(fn: Function) {
		if ('function' !== typeof fn) {
			throw new TypeError('Supplied parameter should be callable.');
		}
		//不允许多次初始化（比如使用MiniPromise.call(promise, function(){})）
		if (undefined !== this.state) {
			throw new TypeError('Cant\'t reconstruct a exist promise.');
		}
		//初始化
		this.state = State.PENDING;
		//立即执行
		this.resolveTask(fn);
	}

	//立即执行任务函数
	private resolveTask(fn) {
		let done = false; //确保仅被解决一次
		try {
			fn((result) => { //成功完成
				if (done) { return ; }
				done = true;
				// this.resolve(result);
				MiniPromise.nextTick(() => this.resolve(result)); //放到下一个事件循环中执行（此举在于支持promise被立即解决后，在当前代码段(当前事件循环)中，还可在后面继续添加then操作）
			}, (error) => { //任务fn主动reject，则立即reject
				if (done) { return ; }
				done = true;
				this.reject(error);
			});
		} catch(err) { //任务fn执行时有异常，立即reject
			if (done) { return ; }
			this.reject(err);
		}
	}

	//尝试使用一个结果值来完成此promise，若结果值是promise，则会等待其完成后解决此promise
	private resolve(result) {
		if (MiniPromise.isThenable(result)) { //若得到的结果是一个promise(相当于当前promise的孩子)，那么需要等待此promise完成
			result.then(this.fulfill.bind(this), this.reject.bind(this));
		} else { //若是最终结果值，则直接解决
			this.fulfill(result);
		}
	}

	/**
	 * 标记当前promise已解决，并执行回调处理函数
	 * 
	 * @param {boolean} fulfilled 是否标记为fulfilled状态，否则为rejected
	 * @param {*} value 成功完成后的结果值或失败后的错误值
	 * 
	 * @memberOf MiniPromise
	 */
	complete(fulfilled: boolean, value: any) {
		this.state = fulfilled ? State.FULFILLED : State.REJECTED;
		this.value = value;
		for (let i = 0, gap = fulfilled ? 0 : 1, handlers = this.handlers, len = handlers.length; i < len; i += 2) {
			let handler = handlers[i + gap];
			if ('function' === typeof handler) {
				handler(this.value);
			}
		}
		this.handlers = null; //清空以便GC
	}
	fulfill(result) { this.complete(true, result); }
	reject(error) { this.complete(false, error); }

	//添加一个结果回调（同其他库的done）
	addHandler(onFulfilled?: Function, onRejected?: Function) {
		MiniPromise.nextTick(() => { //此举在于race中，先定义的promise先被解决（有点仅在于满足测试的意味了:(）
			if (this.state === State.PENDING) {
				this.handlers.push(onFulfilled, onRejected);
			} else if (this.state === State.FULFILLED) { //若当前promise已解决，那么不需要再添加到handlers属性中了（即使添加了也不会被执行），此举主要用于执行那些 在promise已完成后才被添加的handler函数（比如下方：TEST-2同步方式时会导致handler没有执行）
				if ('function' === typeof onFulfilled) { onFulfilled(this.value); }
			} else if (this.state === State.REJECTED) {
				if ('function' === typeof onRejected) { onRejected(this.value); }
			}
		});
	}

	//then方法的目的在于返回一个新的promise，该promise的任务函数的作用在于监听当前promise的完成事件，当前promise完成后，会继续去完成新promise
	then(onFulfilled?: Function, onRejected?: Function) {
		MiniPromise.checkBadInstance(this);
		return new MiniPromise((resolve, reject) => {
			//监听当前promise的成功和失败事件
			this.addHandler((result) => {
				if ('function' === typeof onFulfilled) {
					try {
						resolve(onFulfilled(result)); //执行onFulfilled函数并用其结果值来解决新promise(若结果值是promise，同上面一样，会先等待其完成后，才完成此新promise)
					} catch (err) { //当执行onFulfilled时抛异常，则直接reject掉此新promise
						reject(err);
					}
				} else { //默认直接resolve掉此新promise
					resolve(result);
				}
			}, (error) => {
				if ('function' === typeof onRejected) {
					try {
						resolve(onRejected(error)); //向后[传递]，以便可被后续then拦截
					} catch (err) {
						reject(err);
					}
				} else {
					reject(error);
				}
			});
		});
	}

	//catch方法与then类似，区别在于它仅监听reject(失败)事件
	catch(onRejected) {
		return this.then(null, onRejected);
	}

	//某对象是否是promise
	static isThenable(thenable) {
		return 'object' === typeof thenable && 'function' === typeof thenable.then;
	}

	static resolve(result?: any) {
		this.checkBadClass(this);
		if (this.isThenable(result)) { return result; }
		return new this((resolve) => resolve(result));
	}

	static reject(error?: any) {
		this.checkBadClass(this);
		return new this((resolve, reject) => reject(error));
	}

	static defer() {
		let defer = { resolve: null, reject: null, promise: null };
		defer.promise = new this((resolve, reject) => {
			defer.resolve = resolve;
			defer.reject = reject;
		});
		return defer;
	}

	static all(iterable: any) {
		this.checkBadClass(this);
		if (!this.isIterable(iterable)) { return this.reject(new TypeError('Supplied parameter should be iterable.')); }
		if (!iterable.length) { return this.resolve([]); }
		let
			values = [], resolvedNum = 0,
			completed = false, total = iterable.length, defer = this.defer(),
			complete = function(index, value, isError: boolean = false) {
				if (!completed) {
					if (isError) {
						completed = true;
						defer.reject(value);
					} else {
						values[index] = value;
						if (++resolvedNum >= total) {
							completed = true;
							defer.resolve(values);
						}
					}
				}
			};
		for (let i = 0; i < total && !completed; i++) {
			let thenable = iterable[i];
			if (this.isThenable(thenable)) {
				thenable.then((result) => complete(i, result), (error) => complete(i, error, true));
			} else {
				complete(i, thenable);
			}
		}
		return defer.promise;
	}

	static race(iterable: any) {
		this.checkBadClass(this);
		if (!this.isIterable(iterable)) { return this.reject(new TypeError('Supplied parameter should be iterable.')); }
		// if (!iterable.length) { return this.resolve(); } //若是空数组，则后面直接返回的是pending的promise
		return new MiniPromise((resolve, reject) => {
			for (let value of iterable) {
				this.resolve(value).then(resolve, reject);
			}
		});
	}

	//若非标准constructor或instance，则报错
	static checkBadClass(cls) {
		if (cls !== MiniPromise) { throw new TypeError('Bad promise constructor.'); }
	}
	static checkBadInstance(inst) {
		if (inst.constructor !== MiniPromise) { throw new TypeError('Bad promise instance.'); }
	}

	//是否是可遍历的对象（用于all()）
	static isIterable(iterable) {
		// if (null === iterable || undefined === iterable) { return false; }
		// return 'function' === typeof iterable[Symbol.iterator]; // NEED es6
		// return Array.isArray(iterable);
		return '[object Array]' === Object.prototype.toString.call(iterable);
	}

	//在下一个event loop中执行某函数
	static nextTick(fn) {
		//node环境
		process.nextTick(fn);
		//other TODO
	}

}

export default MiniPromise;
export { MiniPromise as Promise };