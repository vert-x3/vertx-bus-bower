## SockJS Event Bus bridge for Vert.x 3
The `vertxbus.js` file is a SockJS-based event bus bridge to connect your JavaScript frontend application to Vert.x 3.
 This is not a client for Node.js.



The vert.x web site: http://vertx.io
The Event Bus Bridge documentation: http://vertx.io/docs/vertx-web/java/#_sockjs_event_bus_bridge

## Build

This project is exotic... It generate a git repository compliant with the Bower expectation. It:

1. Compute the `bower.json` content and copy it to the root directory
2. Download the vert.x event bus bridge and copy it to the root directory

Generation is triggered by `mvn clean package`

## Updating

* 1) Open the `pom.xml` file and edit the project version.
* 2) Update using `mvn clean package`
* 3) Add all modified files:

```
git add bower.json vertxbus.js
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