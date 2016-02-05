## SockJS Event Bus bridge for Vert.x 3
The `vertx-eventbus.js` file is a SockJS-based event bus bridge to connect your JavaScript frontend application to Vert
.x 3.x. You can use it in a front-end application or in a node.js application.

If you already use a previous version of the bridge, please check the changelog below.

* The vert.x web site: http://vertx.io
* The Event Bus Bridge documentation: http://vertx.io/docs/vertx-web/java/#_sockjs_event_bus_bridge

## Changelog

** Changes from the 3.1.1 to 3.2

* Update the eventbus client version to 3.2.0

**Changes from the 3.1 to 3.1.1**

* Update the `main` attribute in the `bower.json` file.

**Changes from the 3.0.x to 3.1**

* IMPORTANT: The API has been changed to be compatible with node.js and to be closer to the vert.x eventbus API
.Creating  the bridge is made using `var eb = new EventBus("http://localhost:8080/eventbus");` instead of `new vertx
.EventBus...`. In addition, registering a handler use the node convention:
`eb.registerHandler("metrics", function(err, res) {...}` instead of `ev.registerHandler("metrics", res)`.
* The file name has been updated to `eventbus-client.js`

## Build

This project is exotic... It generate a git repository compliant with the Bower expectation. It:

1. Compute the `bower.json` content and copy it to the root directory
2. Download the vert.x event bus bridge and copy it to the root directory

Generation is triggered by `mvn clean package`

## Updating

* 1) Open the `pom.xml` file and edit the `vertx.version` property (~ project version) and the `package.version` (packaging iteration)
* 2) Update using `mvn clean package`
* 3) Add all modified files:

NOTE: the `$VERSION` is the `package.version`

```
git add bower.json vertx-eventbus.js
```

* 4) Commit

```    
git commit -m "update version to $VERSION"

```    
* 5) Create tag

```
git tag -a $VERSION -m "tag for version $VERSION"
```

* 6) Push everything

```    
git push origin --tags master
```

Done.

As the repository is already registered on Bower, the update should be automatic.    
