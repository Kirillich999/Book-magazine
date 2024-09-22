(function () {
    'use strict';

    class AbstractPage {

        constructor() {
            this.app = document.getElementById("root");
        }


        setTitle (title) {
            document.title = title;
        }

        render() {
            return
        }

        errorHandler(error) {
            if(error instanceof Error) {
                console.log("Application is failed", error.message);
            }
        }
        unmount() {
            return
        }

    }

    const PATH_SEPARATOR = '.';
    const TARGET = Symbol('target');
    const UNSUBSCRIBE = Symbol('unsubscribe');

    function isBuiltinWithMutableMethods(value) {
    	return value instanceof Date
    		|| value instanceof Set
    		|| value instanceof Map
    		|| value instanceof WeakSet
    		|| value instanceof WeakMap
    		|| ArrayBuffer.isView(value);
    }

    function isBuiltinWithoutMutableMethods(value) {
    	return (typeof value === 'object' ? value === null : typeof value !== 'function') || value instanceof RegExp;
    }

    var isArray = Array.isArray;

    function isSymbol(value) {
    	return typeof value === 'symbol';
    }

    const path = {
    	after(path, subPath) {
    		if (isArray(path)) {
    			return path.slice(subPath.length);
    		}

    		if (subPath === '') {
    			return path;
    		}

    		return path.slice(subPath.length + 1);
    	},
    	concat(path, key) {
    		if (isArray(path)) {
    			path = [...path];

    			if (key) {
    				path.push(key);
    			}

    			return path;
    		}

    		if (key && key.toString !== undefined) {
    			if (path !== '') {
    				path += PATH_SEPARATOR;
    			}

    			if (isSymbol(key)) {
    				return path + key.toString();
    			}

    			return path + key;
    		}

    		return path;
    	},
    	initial(path) {
    		if (isArray(path)) {
    			return path.slice(0, -1);
    		}

    		if (path === '') {
    			return path;
    		}

    		const index = path.lastIndexOf(PATH_SEPARATOR);

    		if (index === -1) {
    			return '';
    		}

    		return path.slice(0, index);
    	},
    	last(path) {
    		if (isArray(path)) {
    			return path.at(-1) ?? '';
    		}

    		if (path === '') {
    			return path;
    		}

    		const index = path.lastIndexOf(PATH_SEPARATOR);

    		if (index === -1) {
    			return path;
    		}

    		return path.slice(index + 1);
    	},
    	walk(path, callback) {
    		if (isArray(path)) {
    			for (const key of path) {
    				callback(key);
    			}
    		} else if (path !== '') {
    			let position = 0;
    			let index = path.indexOf(PATH_SEPARATOR);

    			if (index === -1) {
    				callback(path);
    			} else {
    				while (position < path.length) {
    					if (index === -1) {
    						index = path.length;
    					}

    					callback(path.slice(position, index));

    					position = index + 1;
    					index = path.indexOf(PATH_SEPARATOR, position);
    				}
    			}
    		}
    	},
    	get(object, path) {
    		this.walk(path, key => {
    			if (object) {
    				object = object[key];
    			}
    		});

    		return object;
    	},
    	isSubPath(path, subPath) {
    		if (isArray(path)) {
    			if (path.length < subPath.length) {
    				return false;
    			}

    			// eslint-disable-next-line unicorn/no-for-loop
    			for (let i = 0; i < subPath.length; i++) {
    				if (path[i] !== subPath[i]) {
    					return false;
    				}
    			}

    			return true;
    		}

    		if (path.length < subPath.length) {
    			return false;
    		}

    		if (path === subPath) {
    			return true;
    		}

    		if (path.startsWith(subPath)) {
    			return path[subPath.length] === PATH_SEPARATOR;
    		}

    		return false;
    	},
    	isRootPath(path) {
    		if (isArray(path)) {
    			return path.length === 0;
    		}

    		return path === '';
    	},
    };

    function isIterator(value) {
    	return typeof value === 'object' && typeof value.next === 'function';
    }

    // eslint-disable-next-line max-params
    function wrapIterator(iterator, target, thisArgument, applyPath, prepareValue) {
    	const originalNext = iterator.next;

    	if (target.name === 'entries') {
    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value[0] = prepareValue(
    					result.value[0],
    					target,
    					result.value[0],
    					applyPath,
    				);
    				result.value[1] = prepareValue(
    					result.value[1],
    					target,
    					result.value[0],
    					applyPath,
    				);
    			}

    			return result;
    		};
    	} else if (target.name === 'values') {
    		const keyIterator = thisArgument[TARGET].keys();

    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value = prepareValue(
    					result.value,
    					target,
    					keyIterator.next().value,
    					applyPath,
    				);
    			}

    			return result;
    		};
    	} else {
    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value = prepareValue(
    					result.value,
    					target,
    					result.value,
    					applyPath,
    				);
    			}

    			return result;
    		};
    	}

    	return iterator;
    }

    function ignoreProperty(cache, options, property) {
    	return cache.isUnsubscribed
    		|| (options.ignoreSymbols && isSymbol(property))
    		|| (options.ignoreUnderscores && property.charAt(0) === '_')
    		|| ('ignoreKeys' in options && options.ignoreKeys.includes(property));
    }

    /**
    @class Cache
    @private
    */
    class Cache {
    	constructor(equals) {
    		this._equals = equals;
    		this._proxyCache = new WeakMap();
    		this._pathCache = new WeakMap();
    		this.isUnsubscribed = false;
    	}

    	_getDescriptorCache() {
    		if (this._descriptorCache === undefined) {
    			this._descriptorCache = new WeakMap();
    		}

    		return this._descriptorCache;
    	}

    	_getProperties(target) {
    		const descriptorCache = this._getDescriptorCache();
    		let properties = descriptorCache.get(target);

    		if (properties === undefined) {
    			properties = {};
    			descriptorCache.set(target, properties);
    		}

    		return properties;
    	}

    	_getOwnPropertyDescriptor(target, property) {
    		if (this.isUnsubscribed) {
    			return Reflect.getOwnPropertyDescriptor(target, property);
    		}

    		const properties = this._getProperties(target);
    		let descriptor = properties[property];

    		if (descriptor === undefined) {
    			descriptor = Reflect.getOwnPropertyDescriptor(target, property);
    			properties[property] = descriptor;
    		}

    		return descriptor;
    	}

    	getProxy(target, path, handler, proxyTarget) {
    		if (this.isUnsubscribed) {
    			return target;
    		}

    		const reflectTarget = target[proxyTarget];
    		const source = reflectTarget ?? target;

    		this._pathCache.set(source, path);

    		let proxy = this._proxyCache.get(source);

    		if (proxy === undefined) {
    			proxy = reflectTarget === undefined
    				? new Proxy(target, handler)
    				: target;

    			this._proxyCache.set(source, proxy);
    		}

    		return proxy;
    	}

    	getPath(target) {
    		return this.isUnsubscribed ? undefined : this._pathCache.get(target);
    	}

    	isDetached(target, object) {
    		return !Object.is(target, path.get(object, this.getPath(target)));
    	}

    	defineProperty(target, property, descriptor) {
    		if (!Reflect.defineProperty(target, property, descriptor)) {
    			return false;
    		}

    		if (!this.isUnsubscribed) {
    			this._getProperties(target)[property] = descriptor;
    		}

    		return true;
    	}

    	setProperty(target, property, value, receiver, previous) { // eslint-disable-line max-params
    		if (!this._equals(previous, value) || !(property in target)) {
    			const descriptor = this._getOwnPropertyDescriptor(target, property);

    			if (descriptor !== undefined && 'set' in descriptor) {
    				return Reflect.set(target, property, value, receiver);
    			}

    			return Reflect.set(target, property, value);
    		}

    		return true;
    	}

    	deleteProperty(target, property, previous) {
    		if (Reflect.deleteProperty(target, property)) {
    			if (!this.isUnsubscribed) {
    				const properties = this._getDescriptorCache().get(target);

    				if (properties) {
    					delete properties[property];
    					this._pathCache.delete(previous);
    				}
    			}

    			return true;
    		}

    		return false;
    	}

    	isSameDescriptor(a, target, property) {
    		const b = this._getOwnPropertyDescriptor(target, property);

    		return a !== undefined
    			&& b !== undefined
    			&& Object.is(a.value, b.value)
    			&& (a.writable || false) === (b.writable || false)
    			&& (a.enumerable || false) === (b.enumerable || false)
    			&& (a.configurable || false) === (b.configurable || false)
    			&& a.get === b.get
    			&& a.set === b.set;
    	}

    	isGetInvariant(target, property) {
    		const descriptor = this._getOwnPropertyDescriptor(target, property);

    		return descriptor !== undefined
    			&& descriptor.configurable !== true
    			&& descriptor.writable !== true;
    	}

    	unsubscribe() {
    		this._descriptorCache = null;
    		this._pathCache = null;
    		this._proxyCache = null;
    		this.isUnsubscribed = true;
    	}
    }

    function isObject(value) {
    	return toString.call(value) === '[object Object]';
    }

    function isDiffCertain() {
    	return true;
    }

    function isDiffArrays(clone, value) {
    	return clone.length !== value.length || clone.some((item, index) => value[index] !== item);
    }

    const IMMUTABLE_OBJECT_METHODS = new Set([
    	'hasOwnProperty',
    	'isPrototypeOf',
    	'propertyIsEnumerable',
    	'toLocaleString',
    	'toString',
    	'valueOf',
    ]);

    const IMMUTABLE_ARRAY_METHODS = new Set([
    	'concat',
    	'includes',
    	'indexOf',
    	'join',
    	'keys',
    	'lastIndexOf',
    ]);

    const MUTABLE_ARRAY_METHODS = {
    	push: isDiffCertain,
    	pop: isDiffCertain,
    	shift: isDiffCertain,
    	unshift: isDiffCertain,
    	copyWithin: isDiffArrays,
    	reverse: isDiffArrays,
    	sort: isDiffArrays,
    	splice: isDiffArrays,
    	flat: isDiffArrays,
    	fill: isDiffArrays,
    };

    const HANDLED_ARRAY_METHODS = new Set([
    	...IMMUTABLE_OBJECT_METHODS,
    	...IMMUTABLE_ARRAY_METHODS,
    	...Object.keys(MUTABLE_ARRAY_METHODS),
    ]);

    function isDiffSets(clone, value) {
    	if (clone.size !== value.size) {
    		return true;
    	}

    	for (const element of clone) {
    		if (!value.has(element)) {
    			return true;
    		}
    	}

    	return false;
    }

    const COLLECTION_ITERATOR_METHODS = [
    	'keys',
    	'values',
    	'entries',
    ];

    const IMMUTABLE_SET_METHODS = new Set([
    	'has',
    	'toString',
    ]);

    const MUTABLE_SET_METHODS = {
    	add: isDiffSets,
    	clear: isDiffSets,
    	delete: isDiffSets,
    	forEach: isDiffSets,
    };

    const HANDLED_SET_METHODS = new Set([
    	...IMMUTABLE_SET_METHODS,
    	...Object.keys(MUTABLE_SET_METHODS),
    	...COLLECTION_ITERATOR_METHODS,
    ]);

    function isDiffMaps(clone, value) {
    	if (clone.size !== value.size) {
    		return true;
    	}

    	let bValue;
    	for (const [key, aValue] of clone) {
    		bValue = value.get(key);

    		if (bValue !== aValue || (bValue === undefined && !value.has(key))) {
    			return true;
    		}
    	}

    	return false;
    }

    const IMMUTABLE_MAP_METHODS = new Set([...IMMUTABLE_SET_METHODS, 'get']);

    const MUTABLE_MAP_METHODS = {
    	set: isDiffMaps,
    	clear: isDiffMaps,
    	delete: isDiffMaps,
    	forEach: isDiffMaps,
    };

    const HANDLED_MAP_METHODS = new Set([
    	...IMMUTABLE_MAP_METHODS,
    	...Object.keys(MUTABLE_MAP_METHODS),
    	...COLLECTION_ITERATOR_METHODS,
    ]);

    class CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		this._path = path;
    		this._isChanged = false;
    		this._clonedCache = new Set();
    		this._hasOnValidate = hasOnValidate;
    		this._changes = hasOnValidate ? [] : null;

    		this.clone = path === undefined ? value : this._shallowClone(value);
    	}

    	static isHandledMethod(name) {
    		return IMMUTABLE_OBJECT_METHODS.has(name);
    	}

    	_shallowClone(value) {
    		let clone = value;

    		if (isObject(value)) {
    			clone = {...value};
    		} else if (isArray(value) || ArrayBuffer.isView(value)) {
    			clone = [...value];
    		} else if (value instanceof Date) {
    			clone = new Date(value);
    		} else if (value instanceof Set) {
    			clone = new Set([...value].map(item => this._shallowClone(item)));
    		} else if (value instanceof Map) {
    			clone = new Map();

    			for (const [key, item] of value.entries()) {
    				clone.set(key, this._shallowClone(item));
    			}
    		}

    		this._clonedCache.add(clone);

    		return clone;
    	}

    	preferredThisArg(isHandledMethod, name, thisArgument, thisProxyTarget) {
    		if (isHandledMethod) {
    			if (isArray(thisProxyTarget)) {
    				this._onIsChanged = MUTABLE_ARRAY_METHODS[name];
    			} else if (thisProxyTarget instanceof Set) {
    				this._onIsChanged = MUTABLE_SET_METHODS[name];
    			} else if (thisProxyTarget instanceof Map) {
    				this._onIsChanged = MUTABLE_MAP_METHODS[name];
    			}

    			return thisProxyTarget;
    		}

    		return thisArgument;
    	}

    	update(fullPath, property, value) {
    		const changePath = path.after(fullPath, this._path);

    		if (property !== 'length') {
    			let object = this.clone;

    			path.walk(changePath, key => {
    				if (object?.[key]) {
    					if (!this._clonedCache.has(object[key])) {
    						object[key] = this._shallowClone(object[key]);
    					}

    					object = object[key];
    				}
    			});

    			if (this._hasOnValidate) {
    				this._changes.push({
    					path: changePath,
    					property,
    					previous: value,
    				});
    			}

    			if (object?.[property]) {
    				object[property] = value;
    			}
    		}

    		this._isChanged = true;
    	}

    	undo(object) {
    		let change;

    		for (let index = this._changes.length - 1; index !== -1; index--) {
    			change = this._changes[index];

    			path.get(object, change.path)[change.property] = change.previous;
    		}
    	}

    	isChanged(value) {
    		return this._onIsChanged === undefined
    			? this._isChanged
    			: this._onIsChanged(this.clone, value);
    	}

    	isPathApplicable(changePath) {
    		return path.isRootPath(this._path) || path.isSubPath(changePath, this._path);
    	}
    }

    class CloneArray extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_ARRAY_METHODS.has(name);
    	}
    }

    class CloneDate extends CloneObject {
    	undo(object) {
    		object.setTime(this.clone.getTime());
    	}

    	isChanged(value, equals) {
    		return !equals(this.clone.valueOf(), value.valueOf());
    	}
    }

    class CloneSet extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_SET_METHODS.has(name);
    	}

    	undo(object) {
    		for (const value of this.clone) {
    			object.add(value);
    		}

    		for (const value of object) {
    			if (!this.clone.has(value)) {
    				object.delete(value);
    			}
    		}
    	}
    }

    class CloneMap extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_MAP_METHODS.has(name);
    	}

    	undo(object) {
    		for (const [key, value] of this.clone.entries()) {
    			object.set(key, value);
    		}

    		for (const key of object.keys()) {
    			if (!this.clone.has(key)) {
    				object.delete(key);
    			}
    		}
    	}
    }

    class CloneWeakSet extends CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		super(undefined, path, argumentsList, hasOnValidate);

    		this._argument1 = argumentsList[0];
    		this._weakValue = value.has(this._argument1);
    	}

    	isChanged(value) {
    		return this._weakValue !== value.has(this._argument1);
    	}

    	undo(object) {
    		if (this._weakValue && !object.has(this._argument1)) {
    			object.add(this._argument1);
    		} else {
    			object.delete(this._argument1);
    		}
    	}
    }

    class CloneWeakMap extends CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		super(undefined, path, argumentsList, hasOnValidate);

    		this._weakKey = argumentsList[0];
    		this._weakHas = value.has(this._weakKey);
    		this._weakValue = value.get(this._weakKey);
    	}

    	isChanged(value) {
    		return this._weakValue !== value.get(this._weakKey);
    	}

    	undo(object) {
    		const weakHas = object.has(this._weakKey);

    		if (this._weakHas && !weakHas) {
    			object.set(this._weakKey, this._weakValue);
    		} else if (!this._weakHas && weakHas) {
    			object.delete(this._weakKey);
    		} else if (this._weakValue !== object.get(this._weakKey)) {
    			object.set(this._weakKey, this._weakValue);
    		}
    	}
    }

    class SmartClone {
    	constructor(hasOnValidate) {
    		this._stack = [];
    		this._hasOnValidate = hasOnValidate;
    	}

    	static isHandledType(value) {
    		return isObject(value)
    			|| isArray(value)
    			|| isBuiltinWithMutableMethods(value);
    	}

    	static isHandledMethod(target, name) {
    		if (isObject(target)) {
    			return CloneObject.isHandledMethod(name);
    		}

    		if (isArray(target)) {
    			return CloneArray.isHandledMethod(name);
    		}

    		if (target instanceof Set) {
    			return CloneSet.isHandledMethod(name);
    		}

    		if (target instanceof Map) {
    			return CloneMap.isHandledMethod(name);
    		}

    		return isBuiltinWithMutableMethods(target);
    	}

    	get isCloning() {
    		return this._stack.length > 0;
    	}

    	start(value, path, argumentsList) {
    		let CloneClass = CloneObject;

    		if (isArray(value)) {
    			CloneClass = CloneArray;
    		} else if (value instanceof Date) {
    			CloneClass = CloneDate;
    		} else if (value instanceof Set) {
    			CloneClass = CloneSet;
    		} else if (value instanceof Map) {
    			CloneClass = CloneMap;
    		} else if (value instanceof WeakSet) {
    			CloneClass = CloneWeakSet;
    		} else if (value instanceof WeakMap) {
    			CloneClass = CloneWeakMap;
    		}

    		this._stack.push(new CloneClass(value, path, argumentsList, this._hasOnValidate));
    	}

    	update(fullPath, property, value) {
    		this._stack.at(-1).update(fullPath, property, value);
    	}

    	preferredThisArg(target, thisArgument, thisProxyTarget) {
    		const {name} = target;
    		const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, name);

    		return this._stack.at(-1)
    			.preferredThisArg(isHandledMethod, name, thisArgument, thisProxyTarget);
    	}

    	isChanged(isMutable, value, equals) {
    		return this._stack.at(-1).isChanged(isMutable, value, equals);
    	}

    	isPartOfClone(changePath) {
    		return this._stack.at(-1).isPathApplicable(changePath);
    	}

    	undo(object) {
    		if (this._previousClone !== undefined) {
    			this._previousClone.undo(object);
    		}
    	}

    	stop() {
    		this._previousClone = this._stack.pop();

    		return this._previousClone.clone;
    	}
    }

    /* eslint-disable unicorn/prefer-spread */

    const defaultOptions = {
    	equals: Object.is,
    	isShallow: false,
    	pathAsArray: false,
    	ignoreSymbols: false,
    	ignoreUnderscores: false,
    	ignoreDetached: false,
    	details: false,
    };

    const onChange = (object, onChange, options = {}) => {
    	options = {
    		...defaultOptions,
    		...options,
    	};

    	const proxyTarget = Symbol('ProxyTarget');
    	const {equals, isShallow, ignoreDetached, details} = options;
    	const cache = new Cache(equals);
    	const hasOnValidate = typeof options.onValidate === 'function';
    	const smartClone = new SmartClone(hasOnValidate);

    	// eslint-disable-next-line max-params
    	const validate = (target, property, value, previous, applyData) => !hasOnValidate
    		|| smartClone.isCloning
    		|| options.onValidate(path.concat(cache.getPath(target), property), value, previous, applyData) === true;

    	const handleChangeOnTarget = (target, property, value, previous) => {
    		if (
    			!ignoreProperty(cache, options, property)
    			&& !(ignoreDetached && cache.isDetached(target, object))
    		) {
    			handleChange(cache.getPath(target), property, value, previous);
    		}
    	};

    	// eslint-disable-next-line max-params
    	const handleChange = (changePath, property, value, previous, applyData) => {
    		if (smartClone.isCloning && smartClone.isPartOfClone(changePath)) {
    			smartClone.update(changePath, property, previous);
    		} else {
    			onChange(path.concat(changePath, property), value, previous, applyData);
    		}
    	};

    	const getProxyTarget = value => value
    		? (value[proxyTarget] ?? value)
    		: value;

    	const prepareValue = (value, target, property, basePath) => {
    		if (
    			isBuiltinWithoutMutableMethods(value)
    			|| property === 'constructor'
    			|| (isShallow && !SmartClone.isHandledMethod(target, property))
    			|| ignoreProperty(cache, options, property)
    			|| cache.isGetInvariant(target, property)
    			|| (ignoreDetached && cache.isDetached(target, object))
    		) {
    			return value;
    		}

    		if (basePath === undefined) {
    			basePath = cache.getPath(target);
    		}

    		/*
      		Check for circular references.

      		If the value already has a corresponding path/proxy,
    		and if the path corresponds to one of the parents,
    		then we are on a circular case, where the child is pointing to their parent.
    		In this case we return the proxy object with the shortest path.
      		*/
    		const childPath = path.concat(basePath, property);
    		const existingPath = cache.getPath(value);

    		if (existingPath && isSameObjectTree(childPath, existingPath)) {
    			// We are on the same object tree but deeper, so we use the parent path.
    			return cache.getProxy(value, existingPath, handler, proxyTarget);
    		}

    		return cache.getProxy(value, childPath, handler, proxyTarget);
    	};

    	/*
    	Returns true if `childPath` is a subpath of `existingPath`
    	(if childPath starts with existingPath). Otherwise, it returns false.

     	It also returns false if the 2 paths are identical.

     	For example:
    	- childPath    = group.layers.0.parent.layers.0.value
    	- existingPath = group.layers.0.parent
    	*/
    	const isSameObjectTree = (childPath, existingPath) => {
    		if (isSymbol(childPath) || childPath.length <= existingPath.length) {
    			return false;
    		}

    		if (isArray(existingPath) && existingPath.length === 0) {
    			return false;
    		}

    		const childParts = isArray(childPath) ? childPath : childPath.split(PATH_SEPARATOR);
    		const existingParts = isArray(existingPath) ? existingPath : existingPath.split(PATH_SEPARATOR);

    		if (childParts.length <= existingParts.length) {
    			return false;
    		}

    		return !(existingParts.some((part, index) => part !== childParts[index]));
    	};

    	const handler = {
    		get(target, property, receiver) {
    			if (isSymbol(property)) {
    				if (property === proxyTarget || property === TARGET) {
    					return target;
    				}

    				if (
    					property === UNSUBSCRIBE
    					&& !cache.isUnsubscribed
    					&& cache.getPath(target).length === 0
    				) {
    					cache.unsubscribe();
    					return target;
    				}
    			}

    			const value = isBuiltinWithMutableMethods(target)
    				? Reflect.get(target, property)
    				: Reflect.get(target, property, receiver);

    			return prepareValue(value, target, property);
    		},

    		set(target, property, value, receiver) {
    			value = getProxyTarget(value);

    			const reflectTarget = target[proxyTarget] ?? target;
    			const previous = reflectTarget[property];

    			if (equals(previous, value) && property in target) {
    				return true;
    			}

    			const isValid = validate(target, property, value, previous);

    			if (
    				isValid
    				&& cache.setProperty(reflectTarget, property, value, receiver, previous)
    			) {
    				handleChangeOnTarget(target, property, target[property], previous);

    				return true;
    			}

    			return !isValid;
    		},

    		defineProperty(target, property, descriptor) {
    			if (!cache.isSameDescriptor(descriptor, target, property)) {
    				const previous = target[property];

    				if (
    					validate(target, property, descriptor.value, previous)
    					&& cache.defineProperty(target, property, descriptor, previous)
    				) {
    					handleChangeOnTarget(target, property, descriptor.value, previous);
    				}
    			}

    			return true;
    		},

    		deleteProperty(target, property) {
    			if (!Reflect.has(target, property)) {
    				return true;
    			}

    			const previous = Reflect.get(target, property);
    			const isValid = validate(target, property, undefined, previous);

    			if (
    				isValid
    				&& cache.deleteProperty(target, property, previous)
    			) {
    				handleChangeOnTarget(target, property, undefined, previous);

    				return true;
    			}

    			return !isValid;
    		},

    		apply(target, thisArg, argumentsList) {
    			const thisProxyTarget = thisArg[proxyTarget] ?? thisArg;

    			if (cache.isUnsubscribed) {
    				return Reflect.apply(target, thisProxyTarget, argumentsList);
    			}

    			if (
    				(details === false
    					|| (details !== true && !details.includes(target.name)))
    				&& SmartClone.isHandledType(thisProxyTarget)
    			) {
    				let applyPath = path.initial(cache.getPath(target));
    				const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, target.name);

    				smartClone.start(thisProxyTarget, applyPath, argumentsList);

    				let result = Reflect.apply(
    					target,
    					smartClone.preferredThisArg(target, thisArg, thisProxyTarget),
    					isHandledMethod
    						? argumentsList.map(argument => getProxyTarget(argument))
    						: argumentsList,
    				);

    				const isChanged = smartClone.isChanged(thisProxyTarget, equals);
    				const previous = smartClone.stop();

    				if (SmartClone.isHandledType(result) && isHandledMethod) {
    					if (thisArg instanceof Map && target.name === 'get') {
    						applyPath = path.concat(applyPath, argumentsList[0]);
    					}

    					result = cache.getProxy(result, applyPath, handler);
    				}

    				if (isChanged) {
    					const applyData = {
    						name: target.name,
    						args: argumentsList,
    						result,
    					};
    					const changePath = smartClone.isCloning
    						? path.initial(applyPath)
    						: applyPath;
    					const property = smartClone.isCloning
    						? path.last(applyPath)
    						: '';

    					if (validate(path.get(object, changePath), property, thisProxyTarget, previous, applyData)) {
    						handleChange(changePath, property, thisProxyTarget, previous, applyData);
    					} else {
    						smartClone.undo(thisProxyTarget);
    					}
    				}

    				if (
    					(thisArg instanceof Map || thisArg instanceof Set)
    					&& isIterator(result)
    				) {
    					return wrapIterator(result, target, thisArg, applyPath, prepareValue);
    				}

    				return result;
    			}

    			return Reflect.apply(target, thisArg, argumentsList);
    		},
    	};

    	const proxy = cache.getProxy(object, options.pathAsArray ? [] : '', handler);
    	onChange = onChange.bind(proxy);

    	if (hasOnValidate) {
    		options.onValidate = options.onValidate.bind(proxy);
    	}

    	return proxy;
    };

    onChange.target = proxy => proxy?.[TARGET] ?? proxy;
    onChange.unsubscribe = proxy => proxy?.[UNSUBSCRIBE] ?? proxy;

    class DivCoomponent {
        constructor() {
            this.element = document.createElement("div");
        }

        render() {
            this.element;
        }
    }

    class Header extends DivCoomponent {
        constructor(appState) {
            super();
            this.appState = appState;
        }

        render() {
            this.element.innerHTML = "";
            this.element.classList.add("header");
            this.element.innerHTML = `
        <a href="/">
        <img src="../../../static/Logo.svg" alt="Logo">
        </a>

        <div class="menu">
        <a href="#search" class="menu__link">
            <img src="../../../static/search.svg" alt="">
            Поиск книг
        </a>

        <a href="#favorites" class="menu__link">
            <img src="../../../static/favorites.svg" alt="">
            Избранное
        </a>
        <div class="menu__counter">
        ${this.appState.favorites.length}
            
        </div>
    </div>
        `;
            return this.element
        }

    }

    class Search extends DivCoomponent {
        constructor(state) {
            super();
            this.state = state;
        
        }

        onSearch() {
            const value = this.element.querySelector("input").value;
            this.state.searchValue = value;
            
        }

        render() {
            this.element.innerHTML = "";
            this.element.classList.add("search");
            this.element.innerHTML = `
        <div class="search__wrapper">
             <input 
             value="${this.state.searchValue ?? ""}"
        type="text" 
        class="search__input" 
        placeholder="Найти книгу или автора...."
        />
        <img src="../../../static/search.svg" alt="Иконка поиска">
        </div>
        <button 
        class="search__button"
        type="button"
        alt="Кнопка поиска"
        aria-label="Искать книги"

    >
        <img src="../../../static/search-white.svg" alt="">
    </button>
      
        `;
            this.element.querySelector("button").addEventListener("click", this.onSearch.bind(this));

            this.element.querySelector("input").addEventListener("keydown", (event) => {
                if(event.code === "Enter") this.onSearch();
            });

            return this.element
        }

    }

    class Card extends DivCoomponent {
        constructor(appState, cardState) {
            super();
            this.appState = appState;
            this.cardState = cardState;
        }




        #addFavoriteBook() {
            this.appState.favorites.push(this.cardState); 
        }

        #removeFavoriteBook() {
            this.appState.favorites = this.appState.favorites.filter((b) => b.key !== this.cardState.key);
        }


        #setSearchBookId() {
            this.appState.searchBookId = this.cardState.edition_key[0];
        }

        render() {
            const isFavorites = this.appState.favorites.find(b => b.key === this.cardState.key);
            this.element.innerHTML = "";
            this.element.classList.add("card");
            this.element.innerHTML = `
        <a href="#about-book" class="card__image">
            <img src="https://covers.openlibrary.org/b/id/${this.cardState.cover_i}-S.jpg" alt="Обложка">
        </a>
        <div class="card__info">
            <div class="card__genre">
                ${this.cardState.subject ? this.cardState.subject?.slice(0,1)?.join(" & ") : "Не задано"}
            </div>
            <div class="card__name">
            ${this.cardState.title}
            </div>

            <div class="card__author">
            ${this.cardState.author_name}
            </div>

            <div class="card__footer">
                <button class="button__add ${isFavorites ? "button__active":"" }">
                    ${
                        isFavorites ?
                        `<img src="../../../static/favorites.svg" />`
                        :
                        `<img src="../../../static/favorite-white.svg" />`
                    }
                </button>
            </div>

        </div>

        
       
        `;
            if(isFavorites) {
                this.element.querySelector("button").addEventListener("click", this.#removeFavoriteBook.bind(this));
            }

            else {
                this.element.querySelector("button").addEventListener("click", this.#addFavoriteBook.bind(this));

            }


            this.element.querySelector("a").addEventListener("click", this.#setSearchBookId.bind(this));

            return this.element
        }

    }

    class CardList extends DivCoomponent {
        constructor(appState, parentState) {
            super();
            this.appState = appState;
            this.parentState = parentState;
        }

        render() {

            if(this.parentState.isLoading) {
                const h1 = document.createElement("h1");
                    h1.innerHTML = "Загрузка. . . ";
                    this.element.append(h1);
                    return this.element
                

            }

            const cardGrid = document.createElement("div");
            cardGrid.classList.add("card__grid");
            this.element.append(cardGrid);

            // this.element.innerHTML = ""
            // this.element.classList.add("card__list")
           


            for(const book of this.parentState.bookList) {
                cardGrid.append( new Card(this.appState, book).render());
            }
            return this.element
        }

    }

    class Pagination extends DivCoomponent {
        constructor(state) {
            super();
            this.state = state;
        
        }


        #decreasePage() {
            this.state.page -= 1;

        }

        #increasePage() {
            this.state.page += 1;

        }



        render() {
            this.element.innerHTML = "";
            this.element.classList.add("pagination");
            this.element.innerHTML = `
        <button id="prev__page" class="pagination__btn">
        <img src="../../../static/arrowBack.svg" alt="Arrow back">
         Предыдущая страница
        </button>

       <button id="next__page" class="pagination__btn">
        Следующая страница
        <img src="../../../static/arrownext.svg" alt="Arrow next">
   
        </button>
   
        `;
           this.element.querySelector("#prev__page").addEventListener("click", this.#decreasePage.bind(this));
           this.element.querySelector("#next__page").addEventListener("click", this.#increasePage.bind(this));

            return this.element
        }

    }

    // import Swiper from 'swiper'; 

    class MainPage extends AbstractPage {
        constructor(appState) {
            super();
            this.setTitle("Главная страница");
            this.appState = appState;
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            this.state = onChange(this.state, this.stateHook.bind(this));
            
        }

        state = {
            bookList: [],
            numFound: 0,
            isLoading: false,
            searchValue: "",
            page: 1,
            limit: 12
        }

        appStateHook(path) {
           if(path === "favorites" || path ==="searchBookId" ) {
            this.render();
           }


        
        }


        async stateHook(path) {
            if(path === "searchValue" || path === "page") {

                this.state.isLoading = true;
                const data = await this.getBookList(this.state.searchValue, this.state.page, this.state.limit);
                this.state.bookList = data.docs;
                this.state.numFound = data.numFound;
                this.state.isLoading = false;

            }

            switch(path) {
                case "bookList": this.render();
                break;

                case "numFound": this.render();
                break;

                case "isLoading": this.render();
                break;
            }

            // if(path === "bookList" || path === "numFound" || path === "isLoading") {
            //     this.render()
            // }
        }


    async getBookList(searchValue, page, limit) {
        const getData = await fetch(`https://openlibrary.org/search.json?q=${searchValue}&page=${page}&limit=${limit}`);
        return getData.json()
    }

        render() {
            const main = document.createElement("div");
            main.innerHTML = `
        <h1> Найдено книг - ${this.state.numFound}   </h1>
       
        `;
            main.innerHTML = ``;
            const searchComponent = new Search(this.state).render();
            const cardlist = new CardList(this.appState, this.state).render();
            const paginationComponent = new Pagination(this.state);
            main.append(searchComponent);
            main.append(cardlist);
            if(this.state.bookList.length) {
                main.append(paginationComponent.render());
            }
            this.app.innerHTML = "";
            this.app.append(main);
            this.renderHeader();

        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class NotFoundPage extends AbstractPage {

        render() {
            const notFound = document.createElement("div");
            notFound.innerHTML = " Страница не существует. Ошибка 404!";
            this.app.innerHTML = "";
            this.app.append(notFound);
        }
    }

    class FavoritePage extends AbstractPage {
        constructor(appState) {
            super();
            this.setTitle("Избранное");
            this.appState = appState;
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            
        }

      

        appStateHook(path) {
           if(path === "favorites") {
            this.render();
           }


        
        }

        render() {
            const main = document.createElement("div");
            main.innerHTML = `
        <h1> Избранные книги - ${this.appState.favorites.length}</h1>
       
        `;
        
            const cardlist = new CardList(this.appState, {bookList: this.appState.favorites}).render();
            main.append(cardlist);
            this.app.innerHTML = "";
            this.app.append(main);
            this.renderHeader();

        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class AboutBookPage extends AbstractPage {
        state = {
            book: null,
            isLoading: false
        }
        constructor(appState) {
            super();
            this.setTitle("Информация о книги");
            this.appState = appState;
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            this.state = onChange(this.state, this.stateHook.bind(this));
            this.#setBookData();
            
        }

        stateHook(path) {
            if(path === "isLoading" || path === "book"){
                this.render();
            }
        }

      

        appStateHook(path) {
           if(path === "favorites" || path ==="searchBookId") {
            this.render();
           }


        
        }


        async #setBookData() {
            try {
                this.state.isLoading = true;
                const book = await this.#loadBook();
                this.state.book = book;
                this.state.isLoading = false;
            } catch (e) {
                this.errorHandler(e);
            }
        }

        async #loadBook () {
            try {
                const data = await fetch(`https://openlibrary.org/books/${this.appState.searchBookId}.json`);
                return data.json()
            } catch(e) {
                this.errorHandler(e);
            }

        }


        unmount() {
            onChange.unsubscribe(this.appState);
            onChange.unsubscribe(this.state);
        }

        render() {
            const main = document.createElement("div");
            main.innerHTML = `
        <h1> ${this.state.isLoading ? "Загрузка..." : this.state.book.title} </h1>

       
        `;
            this.app.innerHTML = "";
            this.app.append(main);
            this.renderHeader();

        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class App {

        routes = [
            {
                path: "",
                page: MainPage,
            },

            {
                path: "#favorites",
                page: FavoritePage,
            },

            {
                path: "#about-book",
                page: AboutBookPage,
            }
        ]


        appState = {
            favorites: [],
            searchBookId: null
        }

        constructor() {
            window.addEventListener("hashchange", this.route.bind(this));
            this.route();
        
        }

        route() {
            const page = this.routes.find((r) => r.path === location.hash)?.page;
            if(!page) {
                this.currentPage = new NotFoundPage();
                this.currentPage.render();
                return;
            }
            this.currentPage = new page(this.appState);
            this.currentPage.render();
        }
    }

    new App();

})();
