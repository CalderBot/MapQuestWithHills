var counter = 0;
var myShapePoints =[];
var NEDElevs = [];
var maxGrade = 0;
var minGrade = 0;
var totalDistance = 0;
var totalAscent = 0;
var DATA1 = {};
var start, end;
var STEPSIZE =14;


MQA.EventUtil.observe(window, 'load', function() {

  // Create an options object
  var options = {
		elt: document.getElementById('map'),           
		zoom: 10,                                      
		latLng: { lat: 39.743943, lng: -105.020089 },  // center of map
		mtype: 'map',                                  // map type (map, sat, hyb); defaults to map
		bestFitMargin: 0,                              // margin offset from map viewport when applying a bestfit on shapes
		zoomOnDoubleClick: true                        
  };

	// Construct an instance of MQA.TileMap with the options object, and add a zoom control
	var map = new MQA.TileMap(options);
	MQA.withModule('smallzoom', 'mousewheel', function() {
		map.addControl(
			new MQA.SmallZoom(),
			new MQA.MapCornerPlacement(MQA.MapCorner.TOP_LEFT, new MQA.Size(5,5))
		);
		map.enableMouseWheelZoom(); 
	});

	// A click handler to make a route by clicking a start and end point.
  MQA.EventManager.addListener(map, 'click', eventRaised);



	// First click sets a start, subsequent clicks set a finish and asks for a route.
	function eventRaised(evt) {
		// evt.ll is the LatLng of the mouseClick.
		if( start === undefined ){
			start = new MQA.Poi(evt.ll);
			map.addShape( start );
		} 
		else{ 
			end = new MQA.Poi( evt.ll );
			map.addShape( end );
			MQA.withModule('new-route', function() {
				map.addRoute({request: {locations:[ start, end ] }, display:{colorAlpha:0.4}, success: colorRoute });
			});
		} 
	}

	function colorRoute(directionResponse){
		DATA1 = directionResponse; // for debugging
		myShapePoints = directionResponse.route.shape.shapePoints;
		map.bestFit();             
		// Loop to fill in the map with colored points
		getNED(myShapePoints[0],myShapePoints[1],getNEDCallback);
	}

	function getNED(lat,lng,getNEDCallback){
		$.ajax({
			type:'GET',
			url:'http://ned.usgs.gov/epqs/pqs.php?x='+lng+'&y='+lat+'&units=Feet&output=json',
			crossDomain:true,
			dataType:'jsonp',
			success:getNEDCallback
		})
	}

	function getNEDCallback(data){
		// Example: {"x":-105.05716785742,"y":39.750278327165,"Data_Source":"NED 1/3 arc-second","Elevation":5327.295117,"Units":"Feet"} 
		NEDElevs.push(data.USGS_Elevation_Point_Query_Service.Elevation_Query);
		if( NEDElevs.length > 1 ){
			var p2 = NEDElevs[counter];
			var p1 = NEDElevs[counter-1]; 
			var distance = 5280*MQA.Util.distanceBetween( {lat:p2.y,lng:p2.x}, {lat:p1.y,lng:p1.x} );
			var heightChange = p2.Elevation-p1.Elevation;
			var grade = 100*heightChange/distance;
			var color = getColor(grade);
			// Generate metadata:
			totalDistance += distance;
			maxGrade = Math.max(grade,maxGrade);
			minGrade = Math.min(grade,minGrade);
			totalAscent += Math.max(0,heightChange);
			// Log the results as they come in 
			console.log("distance: ", distance)
			console.log("elevation change: ", heightChange)
			console.log('grade: ', grade)
			console.log("color: ", color)
			console.log("line: ",p1.y,p1.x,p2.y,p2.x )
			// Add the bit of colored route to the map
			MQA.withModule('new-route-collection', function() {
			  var rc = new MQA.RouteCollection({
			    pois: [],
			    line: [p1.y,p1.x,p2.y,p2.x],
			    display: { color:color, colorAlpha:0.8, borderWidth:4, draggable:false }
			  });    
			 	map.addShapeCollection(rc);
			})
			// Add the metadata to the form
			$("#averageGrade").val(Math.round(1000*(NEDElevs[NEDElevs.length-1].Elevation-NEDElevs[0].Elevation)/totalDistance)/10 +" %"); 
			$("#totalAscent").val(Math.round(totalAscent) +" feet"); 
			$("#maxGrade").val(Math.round(maxGrade*10)/10 +" %"); 
			$("#totalDistance").val(Math.round(totalDistance/528)/10 +" miles"); 
		}
		// Repeat the process
		counter++;
		if( STEPSIZE*counter < myShapePoints.length ){
			console.log("myShapePoints to pass to GetNED: ", myShapePoints[STEPSIZE*counter], myShapePoints[STEPSIZE*counter+1]);
			getNED( myShapePoints[STEPSIZE*counter], myShapePoints[STEPSIZE*counter+1], getNEDCallback );
		} 
	}

	// return an hsl value with hue determined by grade
	function getColor(grade){
		// Apmlify the grade, convert it to degrees in range (-pi/2,pi/2), convert to range (0,120)
		var h=60-Math.atan(grade/3)*120/Math.PI;
		return 'hsl('+h+',100%,50%)'
	}

});
