/*
Copyright (c) 2024 Row64, Inc.
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to deal 
in the Software without restriction, including without limitation the rights 
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
copies of the Software, and to permit persons to whom the Software is 
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.
*/


#target "illustrtor"
app.preferences.setBooleanPreference("ShowExternalJSXWarning", false);

main();

// ================================ MAIN ================================
function HaveGeoIdObjects(inO){

    // cycle the active document to figure out if any objects have GEOID tags
    // If any object has it we need to put the tag on all object
    // the tag is defined by having "_GEOID_" in the name
    // the tag value is defined by the string that comes after "_GEOID_"
    // so for "MyObjName_GEOID_Texas", the geojson is: "properties": {"GEOID": "Texas"}

    var gotGeoId = false;
    var doc = app.activeDocument; 
    for (i=0; i<doc.layers.length; i++){
        for(j=0;j<doc.layers[i].pageItems.length;j++){
            var obj=doc.layers[i].pageItems[j];
            if(obj.name != ""){
                if(obj.name.indexOf("_GEOID_") != -1){
                    gotGeoId = true;
                }
            }
        }
    }
    return gotGeoId;
}

function main(){
    var geoJson = {"file":""};
    var hasGeoID = HaveGeoIdObjects(geoJson);
    CycleObjects(geoJson, hasGeoID);
    SaveFile(geoJson);
}

function IsLinear(inPnt, inNextPnt){
    if( Len(Sub(inPnt.anchor,inPnt.rightDirection)) > 0.001 ){return false;}
    if( Len(Sub(inNextPnt.leftDirection,inNextPnt.anchor)) > 0.001 ){return false;}
    return true;
}

function AddCurve(inPnt, inNextPnt){

    var nbDiv = 10;
    var cStr = "";
    if(IsLinear(inPnt, inNextPnt)){
         cStr += "[" +roundton(inPnt.anchor[0],6)+","+ roundton(inPnt.anchor[1],6) +"]"
    }
    else{
        var Ap = inPnt.anchor;
        var Bp = inPnt.rightDirection;
        var Cp = inNextPnt.leftDirection;
        var Dp = inNextPnt.anchor;
        for(var i=0;i<nbDiv;i++){
            var perc = 1 - i/nbDiv;
            var bp = ReadBezier(Ap, Bp, Cp, Dp, perc);
            if(i!=0){cStr+=",";}
            cStr += "[" +roundton(bp[0],6)+","+ roundton(bp[1],6) +"]"
        }
    }

    return cStr;

}

function GetGeoId(inObj){

    if(inObj.name != ""){
        if(inObj.name.indexOf("_GEOID_") != -1){
            // gotGeoId = true;
            var parts = inObj.name.split("_GEOID_");
            if(parts.length>1){
                return parts[1];
            }
            else{
                return "";
            }
        }
    }
    return "NULL";
}

function GetPolyFeature(inObj, inType, inGeoId){

    var pathPnts = inObj.pathPoints;
    var pStr ='    { "type": "Feature",\n      "geometry": {\n        "type": "'+inType+'",\n        "coordinates": '

    if(inType=="Polygon"){pStr+= "[[\n";}
    else{pStr+= "[\n";}

    var pList = [];
    var dl="";
    var maxI = pathPnts.length -1;
    for(var i=0;i<pathPnts.length;i++){
        var nextI = i + 1;
        if(nextI>maxI){nextI=0;}
        pStr += AddCurve(pathPnts[i], pathPnts[nextI]);
        if(i<maxI){pStr +=",";}
    }
    if(inObj.closed){
        pStr += ","+ "[" +roundton(pathPnts[0].anchor[0],6)+","+ roundton(pathPnts[0].anchor[1],6) +"]";
    }

    geoStr = ""

    if(inGeoId){
        var gid = GetGeoId(inObj);
        // pStr += '\n\t\t\t},\n\t\t\t"properties": {"GEOID": "'+gid+'"}\n\t\t}'; 
        geoStr = ',\n   "properties": {"GEOID": "'+gid+'"}';

    }
    // else{
        // pStr += '\n\t\t\t}\n\t\t}';
    // }
    

    if(inType=="Polygon"){
        // pStr += '\n          ]]\n        },\n   "properties": {"prop0": "value0","prop1": {"this": "that"} }\n\t}\n';
        pStr += '\n          ]]\n        }'+ geoStr + '\n\t}\n';
    }
    else{
        // pStr += '\n          ]\n        },\n   "properties": {"prop0": "value0","prop1": {"this": "that"} }\n\t}\n';
        pStr += '\n          ]\n        }'+ geoStr + '\n\t}\n';
    }
    return pStr;
}
function GetMultiPolyFeature(inObj, inCPath, inType, inGeoId){
    var pStr ="";
    if(inType=="Polygon"){
        pStr +='    { "type": "Feature",\n      "geometry": {\n        "type": "Polygon",\n        "coordinates": [\n';
    }
    else{
        pStr +='    { "type": "Feature",\n      "geometry": {\n        "type": "MultiLineString",\n        "coordinates": [\n';
    }
    var pList = [];
    var maxI = inCPath.length -1;
    for(var i=0;i<inCPath.length;i++){
        pStr += "\t[\n";
        var maxJ = inCPath[i].pathPoints.length -1;

        for(var j=0;j<inCPath[i].pathPoints.length;j++){
            var nextJ = j + 1;
            if(nextJ>maxJ){nextJ=0;}
            pStr += AddCurve(inCPath[i].pathPoints[j], inCPath[i].pathPoints[nextJ]);
            if(j<maxJ){pStr +=",";}
        }

        if(inCPath[i].closed){
            pStr +=",[" +roundton(inCPath[i].pathPoints[0].anchor[0],6)+","+ roundton(inCPath[i].pathPoints[0].anchor[1],6) +"]"
        }
        
        if(i==maxI){pStr += "\t]\n";}
        else{pStr += "\t],\n";}
    }

    geoStr = ""
    if(inGeoId){
        var gid = GetGeoId(inObj);
        // geoStr = ',\n   "properties": {"prop0": "value0","prop1": {"this": "that"} }';
        // pStr += '\t\t\t\t],\n\t\t\t},\n\t\t\t"properties": {"GEOID": "'+gid+'"}\n\t\t}'; 
        pStr += '\n          ]\n        },\n\t\t\t"properties": {"GEOID": "'+gid+'"}\n\t}\n';
    }
    else{
        pStr += '\n          ]\n        }\n\t}\n';
    }

    return pStr;
}
function SaveFile(inO){

    // save using a file dialogue 
    var outputFile = new File("GeoJson_File.json").saveDlg(["Save GeoJson File"],["JSON Files:*.json"]);
    if(outputFile!=null){
        outputFile.open("w");
        outputFile.write(inO.file);
        outputFile.close();
    }

    // alternate code if you want to explicitly define the save path

    // var fPath = "C:\\misner\\MadScience\\Row64\\Releases\\V3_3\\_DEMO\\Business_Process\\_LAYERS\\test_02.json";
    // var fileObj = new File([fPath]);
    // fileObj.open("w");
    // fileObj.write(inO.file);
    // fileObj.close();


}


function CycleObjects(inO, inGeoId){
    
    // var cStr = "{ \"type\": \"FeatureCollection\",\n\t\"features\": [\n";

    inO.file += "{ \"type\": \"FeatureCollection\",\n\t\"features\":[\n";

    var doc = app.activeDocument;
    
    var featureBlocks = [];
    for (i=0; i<doc.layers.length; i++){

        if(!doc.layers[i].visible){continue;}
        for(j=0;j<doc.layers[i].pageItems.length;j++){
            var cp=doc.layers[i].pageItems[j];

            if(doc.layers[i].pageItems[j].typename=="PathItem"){
                if(cp.filled){
                    featureBlocks.push( GetPolyFeature(cp, "Polygon", inGeoId) );
                }
                else{
                    featureBlocks.push( GetPolyFeature(cp, "LineString", inGeoId) );
                }
            }
            else if(doc.layers[i].pageItems[j].typename=="CompoundPathItem"){
                
                if(cp.pathItems[0].filled){
                    featureBlocks.push( GetMultiPolyFeature(cp, cp.pathItems, "Polygon", inGeoId) );
                }
                else{
                    featureBlocks.push( GetMultiPolyFeature(cp, cp.pathItems, "MultiLineString", inGeoId) );
                }
            }
        }
    }

    inO.file += featureBlocks.join(",\n");
    inO.file += "\n\t]\n}\n";
    
    // cStr += featureBlocks.join("\n,\n");
    // cStr += "    ]\n}\n";
    // SaveFile(cStr);
}


// ========================= HELPER FUNCTIONS ===========================
function roundton(num, n) {
    return Number(num.toFixed(n));
}
function drawCircle(inP, inRad){
    var top = inP[1]+inRad*.5;
    var left = inP[0]-inRad*.5;
    var cir = app.activeDocument.pathItems.ellipse(top, left, inRad, inRad);
}
function SetFillColor(inObj, inR, inG, inB){
    var rgb = new RGBColor();
    rgb.red = inR;
    rgb.green = inG;
    rgb.blue = inB;
    inObj.fillColor = rgb;
}
function SetPathColor(inObj, inR, inG, inB){
    inObj.strokeColor.red = inR;
    inObj.strokeColor.green = inG;
    inObj.strokeColor.blue = inB;
}
function Dot(inV1,inV2){return inV1[0]*inV2[0]+inV1[1]*inV2[1];}
function Sub(inA,inB){return [inB[0]-inA[0],inB[1]-inA[1]];}
function Add(inA,inB){return [inB[0]+inA[0],inB[1]+inA[1]];}
function MulV(inA,inVal){return [inA[0]*inVal,inA[1]*inVal];}
function Len(inA){return Math.sqrt(inA[0]*inA[0]+inA[1]*inA[1]);} // length of a vector
function Norm(inA){ // normalize vector
    if(inA[0]==0||inA[1]==0){return inA;}
    var vLen = Len(inA);
    return [inA[0]/vLen, inA[1]/vLen];
} 
function Blend(inA,inB,inBlend){
    var xVal = inBlend*inA[0]+(1-inBlend)*inB[0];
    var yVal = inBlend*inA[1]+(1-inBlend)*inB[1];
    return [xVal,yVal];
}
function ReadBezier(inA, inB, inC, inD, inPerc){
    var AB = Blend(inA, inB, inPerc);
    var BC = Blend(inB, inC, inPerc);
    var CD = Blend(inC, inD, inPerc);
    var ABC = Blend(AB, BC, inPerc);
    var BCD = Blend(BC, CD, inPerc);
    return Blend(ABC, BCD, inPerc);
}
function InvV(inA){return [inA[0]*-1,inA[1]*-1];}// invert vector
function TanL(inA){ // tangent vector, rotating to the  left
    return [inA[1]*-1,inA[0]];
}
function TanR(inA){ // tangent of vector, rotating to the right
    return [inA[1],inA[0]*-1];
}
function ProjectToLine(A,B,C){
    // A = start point, B = end point, inC = projection point
    var AB = Sub(A,B);
    var AC = Sub(A,C);
    var dotF = Dot(AB,AC)/Dot(AB,AB);
    var D = [A[0]+AB[0]*dotF,A[1]+AB[1]*dotF];
    return D;
}
function Dist(inA,inB){ // dist between 2 points
    var ABV = Sub(inA,inB);
    return Len(ABV);
}
function GetBB(inObj){
    var xMax = -100000000;var xMin = 100000000;
    var yMax = -100000000;var yMin = 100000000;
    for(var i=0;i<inObj.pathPoints.length;i++){
        var p = inObj.pathPoints[i].anchor;
        if(p[0]>xMax){xMax=p[0];}if(p[0]<xMin){xMin=p[0];}
        if(p[1]>yMax){yMax=p[1];}if(p[1]<yMin){yMin=p[1];}
    }
    return {BL:[xMin,yMin],BR:[xMax,yMin],TL:[xMin,yMax],TR:[xMax,yMax]};
}