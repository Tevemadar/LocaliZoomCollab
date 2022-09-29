let args = JSON.parse(decodeURIComponent(location.search.substring(1)));
args.tools = args.nl = true;
function argspack(pack) {
    return encodeURIComponent(JSON.stringify({
        collab: args["clb-collab-id"],
        token: args.token,
        ...pack
    }));
}

async function getDescriptor() {
    let download = await fetch(`bucket.php?${argspack({filename: args.filename})}`).then(response => response.json());
    return fetch(download.url).then(response => response.json());
}

async function getTile(section, level, x, y) {
    let json = await fetch(`bucket.php?${argspack({collab: sries.bucket, filename: `${section.base}${level}/${x}_${y}.${section.format}`})}`).then(response => response.json());
    return new Promise(resolve => {
        let tile = document.createElement("img");
        tile.onload = () => resolve(tile);
        tile.src = json.url;
    });
}

let sries;
let sections;
let atlas;
async function startup() {
    window.addEventListener("resize", fullscreen);
    fullscreen();

    popup("Loading data");
    sries = await getDescriptor();


    atlas = new Promise(resolve => new Worker("getlas.js?" + sries.atlas)
                .onmessage = event => {
                    if (event.data.hasOwnProperty("blob"))
                        resolve(event.data);
                    else
                        popup(event.data);
                });

    sections = JSON.parse(JSON.stringify(sries.sections));
    for (let section of sections) {
        let filename = section.filename;
        section.snr = parseInt(filename.match(/(?<=_s)\d+/));
        section.anchored = section.hasOwnProperty("ouv");
        let w = section.width, h = section.height, maxlevel = 0;
        while (w > 1 || h > 1) {
            w = (w + 1) >> 1;
            h = (h + 1) >> 1;
            maxlevel++;
        }
        section.maxlevel = maxlevel;
        section.base = `${filename}/${filename.substring(0, filename.lastIndexOf("."))}_files/`;
        if (!section.hasOwnProperty("markers"))
            section.markers = [];
        if (!section.hasOwnProperty("poi"))
            section.poi = [];
    }

    atlas = await atlas;
    atlas.blob = atlas.encoding === 1 ? new Uint8Array(atlas.blob) : new Uint16Array(atlas.blob);
    cover();
    propagate(sections, atlas);

    if (args.view) {
        fs_setalpha(0);
    }
    args.view = !args.tools;
    args.prev = true;
    if (args.view) {
        document.getElementById("tools").style.display = "none";
    } else {
        document.getElementById("tools").style.top = document.getElementById("status").offsetHeight + "px";
        if (args.nl) {
            document.getElementById("toggleNL").style.display = "inline";
        } else {
            document.getElementById("toggleAN").style.display = "inline";
        }
    }
    if (args.opacity) {
        document.getElementById("alpha").value = args.opacity;
        //document.getElementById("outline").value="#FFFFFF";
    }

//                var xhr=new XMLHttpRequest();
//                xhr.open("GET",locators.AtlasLocator(args.atlas));
//                xhr.responseType="json";
//                xhr.onload=descriptorReady;
//                xhr.send();
//            }
//            function descriptorReady(event){
//                atlas=event.target.response;
//                for(var label of atlas.labels)
//                    if(label.rgb){
//                        label.r=parseInt(label.rgb.substr(0,2),16);
//                        label.g=parseInt(label.rgb.substr(2,2),16);
//                        label.b=parseInt(label.rgb.substr(4,2),16);
//                    }
    atlas.transformations.unshift({
        name: "File coords",
        matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    });
    for (var trf of atlas.transformations) {
        var opt = document.createElement("option");
        opt.text = trf.name;
        document.getElementById("traf").appendChild(opt);
    }
    fs_start();
}

function fullscreen() {
    var zc = document.getElementById("zoomcanvas");
    var sc = document.getElementById("scroller");
//    sc.addEventListener("wheel", fs_mwheel, true);

    var help = document.getElementById("help");
    document.getElementById("metadata").style.top = help.style.top = zc.offsetTop + "px";
    help.style.left = window.innerWidth - 520 + "px";

    fs_setwidth(zc.width = sc.width = canvaswidth = window.innerWidth);
    fs_setheight(sc.height = 128 + 20);
    zc.height = canvasheight = window.innerHeight - zc.offsetTop - 128 - 20;
    if (zoomer)
        zoomer.fullcanvas();
}

var overlay = document.createElement("canvas");
var overlaydata, overlayorg;
var overlaywidth;
var overlayheight;
var octx, omgdata, odta;

var pop = null;
var popscape = false;
var zoomer;
var cfg;

let current_section;
let markers;//,poi;
let ouv;
function dispatchSection(section) {
    current_section = section;
    markers = current_section.markers;
    ouv = section.ouv;
    var data = dataslice(section.ouv);
    var w = overlay.width = overlaywidth = data.width;
    var h = overlay.height = overlayheight = data.height;
    octx = overlay.getContext("2d");
    omgdata = octx.createImageData(w, h);
    odta = omgdata.data;
    overlaydata = new Uint16Array(w * h);
    //overlayorg=new Uint16Array(w*h);
    var d = overlayorg = data.data;
    for (var i = 0, is = 0; i < d.length; i++) {
        var col = atlas.labels[overlaydata[i] = d[i]];
        odta[is++] = col.r;
        odta[is++] = col.g;
        odta[is++] = col.b;
        odta[is++] = 255;
    }
    octx.putImageData(omgdata, 0, 0);

    cfg = {
        TileSize: section.tilesize,
        Overlap: section.overlap,
        Format: section.format,
        Width: section.width,
        Height: section.height,
        //FillStyle:"#00FF00",
        MaxLevel: section.maxlevel
    };

    triangulate();

    var meta = document.getElementById("metadata");
    meta.innerHTML = /*ouv.name*/section.filename + "<br>" + cfg.Width.toString() + " x " + cfg.Height.toString() + "<br>"
            + atlas.name;
//            + (args.prev ? "" : ("<br><a href='http://cmbn-navigator.uio.no/navigator/feeder/original/?id=" + section_id + "' target='_blank'>Download image</a>"));
    meta.style.left = window.innerWidth - meta.scrollWidth - 5 + "px";

//    var w = cfg.Width;
//    var h = cfg.Height;
//    while (w > 1 || h > 1) {
//        w = (w + 1) >> 1;
//        h = (h + 1) >> 1;
//        cfg.MaxLevel++;
//    }

//    cfg.Key = function (level, x, y) {
//        return locators.TileLocator(section_id, this.MaxLevel - level, x, y, cfg.Format);
//    };
    cfg.Load = async function (key, section, level, x, y, next) {
        let tile = await getTile(section, level, x, y);
//        var img = document.createElement("img");
        var canvas = document.createElement("canvas");
        canvas.width = cfg.TileSize;
        canvas.height = cfg.TileSize;
        canvas.getContext("2d").drawImage(tile, x === 0 ? 0 : -cfg.Overlap, y === 0 ? 0 : -cfg.Overlap);
        next(canvas);
//        img.onload = function () {
//            canvas.getContext("2d").drawImage(img, x === 0 ? 0 : -cfg.Overlap, y === 0 ? 0 : -cfg.Overlap);
//            next(canvas);
//        };
//        img.onerror = function () {
//            console.log("Invalid tile? " + x + "," + y + " " + key);
//            next(canvas);
//        };
//        img.src = key;
    };
    cfg.Overlay = function (ctx, cw, ch, x, y, w, h) {
//                    var bright=parseInt(document.getElementById("bright").value);
//                    if(bright>1){
//                      var bdata=ctx.getImageData(0,0,cw,ch);
//                      var bdat=bdata.data;
//                      for(var i=0;i<cw*ch*4;i++)
//                        bdat[i]*=bright;
//                      ctx.putImageData(bdata,0,0);
//                    }
        var ovltrgx = 0;
        var ovltrgy = 0;
        var ovltrgw = cw;
        var ovltrgh = ch;
        var ovlcutx = overlay.width * x / cfg.Width;
        var ovlcuty = overlay.height * y / cfg.Height;
        var ovlcutw = overlay.width * w / cfg.Width;
        var ovlcuth = overlay.height * h / cfg.Height;
        if (ovlcutx < 0) {
            ovltrgx = -x * cw / w;
            ovlcutx = 0;
        }
        if (ovlcuty < 0) {
            ovltrgy = -y * ch / h;
            ovlcuty = 0;
        }
        if (ovlcutw > overlay.width) {
            ovltrgw -= (w - cfg.Width) * cw / w;
            ovlcutw = overlay.width;
        }
        if (ovlcuth > overlay.height) {
            ovltrgh -= (h - cfg.Height) * ch / h;
            ovlcuth = overlay.height;
        }
        var alpha = parseInt(document.getElementById("alpha").value);
        ctx.globalAlpha = alpha / 100;
        ctx.drawImage(overlay, ovlcutx, ovlcuty, ovlcutw, ovlcuth, ovltrgx, ovltrgy, ovltrgw, ovltrgh);
        ctx.globalAlpha = 1;

        if (show_triangles.checked) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            triangles.forEach(function (triangle) {
                var v = vertices[triangle[2]];
                ctx.moveTo(
                        Math.round((v[0] - x) * cw / w) + 0.5,
                        Math.round((v[1] - y) * ch / h) + 0.5
                        );
                for (var i = 0; i < 3; i++) {
                    var v = vertices[triangle[i]];
                    ctx.lineTo(
                            Math.round((v[0] - x) * cw / w) + 0.5,
                            Math.round((v[1] - y) * ch / h) + 0.5
                            );
                }
            });
            ctx.stroke();
        }
        if (!args.view) {
            if (args.nl) {
                ctx.strokeStyle = "#FFFF80";
                try {
                    ctx.strokeStyle = document.getElementById("nlcolor").value;
                } catch (ex) {
                }
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                for (var i = 0; i < markers.length; i++) {
                    ctx.moveTo(Math.round((markers[i].x - x) * cw / w) + 0.5,
                            Math.round((markers[i].y - y) * ch / h) + 0.5);
                    var sx = Math.round((markers[i].nx - x) * cw / w) + 0.5;
                    var sy = Math.round((markers[i].ny - y) * ch / h) + 0.5;
                    ctx.lineTo(sx, sy);
                    ctx.moveTo(sx, sy - 10);
                    ctx.lineTo(sx, sy + 10);
                    ctx.moveTo(sx - 10, sy);
                    ctx.lineTo(sx + 10, sy);
                }
                ctx.stroke();
            } else {
                ctx.strokeStyle = "#FFFF80";
                try {
                    ctx.strokeStyle = document.getElementById("ancolor").value;
                } catch (ex) {
                }
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                for (var i = 0; i < poi.length; i++) {
                    var sx = Math.round((poi[i].x - x) * cw / w) + 0.5;
                    var sy = Math.round((poi[i].y - y) * ch / h) + 0.5;
                    ctx.moveTo(sx, sy - 10);
                    ctx.lineTo(sx, sy + 10);
                    ctx.moveTo(sx - 10, sy);
                    ctx.lineTo(sx + 10, sy);
                }
                ctx.stroke();
            }
        }
        if ((pop !== null) && (alpha !== 0)) {
            ctx.fillStyle = "rgb(" + pop.r + "," + pop.g + "," + pop.b + ")";
            if (popscape)
                ctx.fillRect(0, 0, cw, 60);
            else
                ctx.fillRect(0, ch - 60, cw, 60);
            ctx.font = "40px sans-serif";
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (popscape)
                ctx.fillText(pop.name, cw / 2, 30);
            else
                ctx.fillText(pop.name, cw / 2, ch - 30);
        }
    };
    var cursor = {
        screenx: 0, screeny: 0, imagex: 0, imagey: 0
    };
    var prevalpha;
    cfg.MouseMove = function (event, cw, ch, x, y, w, h) {
        cursor.screenx = event.offsetX;
        cursor.screeny = event.offsetY;
        var mx = cursor.imagex = Math.round(x + event.offsetX * w / cw);
        var my = cursor.imagey = Math.round(y + event.offsetY * h / ch);
        if (markerpick !== undefined) {
            if (args.nl) {
                markers[markerpick].nx = mx;
                markers[markerpick].ny = my;
                triangulate();
            } else {
                poi[markerpick].x = mx;
                poi[markerpick].y = my;
            }
            drawImage();
            return;
        }
        var jump = false;
        if (popscape && event.offsetY < ch / 3) {
            popscape = false;
            jump = true;
        }
        if (!popscape && event.offsetY > ch * 2 / 3) {
            popscape = true;
            jump = true;
        }
        var div = document.getElementById("coords");
        var nx = mx / cfg.Width;
        var ny = my / cfg.Height;
        //!! todo: nonlin
        var fx = ouv[0] + ouv[3] * nx + ouv[6] * ny;
        var fy = ouv[1] + ouv[4] * nx + ouv[7] * ny;
        var fz = ouv[2] + ouv[5] * nx + ouv[8] * ny;
        var trf = atlas.transformations[document.getElementById("traf").selectedIndex];
        var xyz1 = mult([[fx, fy, fz, 1]], trf.matrix)[0];
        div.innerText = "(x=" + xyz1[0].toPrecision(5) + " y=" + xyz1[1].toPrecision(5) + " z=" + xyz1[2].toPrecision(5) + ")";
        nx = Math.round(nx * overlaywidth);
        ny = Math.round(ny * overlayheight);
        var oldpop = pop;
        pop = null;
        if ((nx >= 0) && (nx < overlaywidth) && (ny >= 0) && (ny < overlayheight)) {
            pop = overlaydata[nx + ny * overlaywidth];
            pop = pop === 0 ? null : atlas.labels[pop];
        }
        if (oldpop !== pop || jump)
            drawImage();
    };
    var markerpick;
    cfg.MouseDown = function (event, cw, ch, x, y, w, h) {
        if (args.view)
            return false;
        markerpick = undefined;
        if (args.nl) {
            for (var i = 0; i < markers.length; i++) {
                var sx = Math.round((markers[i].nx - x) * cw / w) + 0.5;
                var sy = Math.round((markers[i].ny - y) * ch / h) + 0.5;
                if (event.offsetX > sx - 10 && event.offsetX < sx + 10 && event.offsetY > sy - 10 && event.offsetY < sy + 10)
                    markerpick = i;
            }
        } else {
            for (var i = 0; i < poi.length; i++) {
                var sx = Math.round((poi[i].x - x) * cw / w) + 0.5;
                var sy = Math.round((poi[i].y - y) * ch / h) + 0.5;
                if (event.offsetX > sx - 10 && event.offsetX < sx + 10 && event.offsetY > sy - 10 && event.offsetY < sy + 10)
                    markerpick = i;
            }
        }
        return markerpick !== undefined;
    };
    cfg.MouseUp = function (event, cw, ch, x, y, w, h) {
        markerpick = undefined;
    };
    cfg.KeyDown = function (event, cw, ch, x, y, w, h) {
        var alpha = document.getElementById("alpha");
        switch (event.key) {
            case "ArrowLeft":
                fs_prev();
                break;
            case "ArrowRight":
                fs_next();
                break;
            case "ArrowUp":
                if (prevalpha) {
                    alpha.value = prevalpha;
                    drawImage();
                }
                break;
            case "ArrowDown":
                if (alpha.value !== "0") {
                    prevalpha = alpha.value;
                    alpha.value = 0;
                    drawImage();
                }
                break;
            case "Delete":
                if (!args.view) {
                    if (args.nl) {
                        var idx = undefined;
                        for (var i = 0; i < markers.length; i++) {
                            var sx = Math.round((markers[i].x - x) * cw / w) + 0.5;
                            var sy = Math.round((markers[i].y - y) * ch / h) + 0.5;
                            if (cursor.screenx > sx - 8 && cursor.screenx < sx + 8 && cursor.screeny > sy - 8 && cursor.screeny < sy + 8)
                                idx = i;
                            var sx = Math.round((markers[i].nx - x) * cw / w) + 0.5;
                            var sy = Math.round((markers[i].ny - y) * ch / h) + 0.5;
                            if (cursor.screenx > sx - 8 && cursor.screenx < sx + 8 && cursor.screeny > sy - 8 && cursor.screeny < sy + 8)
                                idx = i;
                        }
                        if (idx !== undefined) {
                            markers.splice(idx, 1);
                            triangulate();
                            drawImage();
                        }
                    } else {
                        var idx = undefined;
                        for (var i = 0; i < poi.length; i++) {
                            var sx = Math.round((poi[i].x - x) * cw / w) + 0.5;
                            var sy = Math.round((poi[i].y - y) * ch / h) + 0.5;
                            if (cursor.screenx > sx - 8 && cursor.screenx < sx + 8 && cursor.screeny > sy - 8 && cursor.screeny < sy + 8)
                                idx = i;
                        }
                        if (idx !== undefined) {
                            poi.splice(idx, 1);
                            drawImage();
                        }
                    }
                }
                break;
            default:
                if (!args.view && cursor.imagex >= 0 && cursor.imagey >= 0 && cursor.imagex <= cfg.Width && cursor.imagey <= cfg.Height) {
                    if (args.nl) {
                        var D = [cursor.imagex, cursor.imagey];
                        for (var triangle of triangles) {
                            var ai = triangle[0];
                            var bi = triangle[1];
                            var ci = triangle[2];
                            var A = vertices[ai];
                            var B = vertices[bi];
                            var C = vertices[ci];
                            var uv1 = intri(A, B, C, D);
                            if (uv1) {
                                //                                        console.log(uv1);
                                if (ai >= 4)
                                    A = markers[ai - 4];
                                else
                                    A = {x: vertices[ai][0], y: vertices[ai][1]};
                                if (bi >= 4)
                                    B = markers[bi - 4];
                                else
                                    B = {x: vertices[bi][0], y: vertices[bi][1]};
                                if (ci >= 4)
                                    C = markers[triangle[2] - 4];
                                else
                                    C = {x: vertices[ci][0], y: vertices[ci][1]};
                                markers.push({
                                    x: A.x + (B.x - A.x) * uv1[0] + (C.x - A.x) * uv1[1],
                                    y: A.y + (B.y - A.y) * uv1[0] + (C.y - A.y) * uv1[1],
                                    nx: cursor.imagex,
                                    ny: cursor.imagey
                                });
                                //                                        console.log(markers[markers.length-1]);
                                D = false;
                                break;
                            }
                        }
                        if (D) {
                            //                                    console.log("!");
                            markers.push({x: cursor.imagex, y: cursor.imagey, nx: cursor.imagex, ny: cursor.imagey});
                        }
                        triangulate();
                        drawImage();
                    } else {
                        poi.push({x: cursor.imagex, y: cursor.imagey});
                        drawImage();
                    }
                }
        }
    };
    if (zoomer)
        zoomer.detach();
    zoomer = new Zoomer(document.getElementById("zoomcanvas"), cfg);
    zoomer.fullcanvas();
}
function drawImage() {
    if (zoomer)
        zoomer.redraw();
}
function excel() {
    // todo: nonlin/canonicalize
    var wnd = window.open("about:blank", "Excel export #" + Date.now());
    var d = wnd.document;
    d.write("<html><head><title>Excel export</title><style>textarea{width:100%;height:80%}</style><script>");
    d.write("function swapdots(){var e=document.getElementById('ta');e.innerHTML=e.innerHTML.replace(/\\./g,',');}");
    d.write("function swapcommas(){var e=document.getElementById('ta');e.innerHTML=e.innerHTML.replace(/,/g,'.');}");
    d.write("<\/script></head><body><textarea id='ta'>");
    var s = "ID\t" + ouv.id + "\t\t\tHIDE\tHIDE\n";
    s += "Resolution\t" + cfg.Width + "\t" + cfg.Height + "\n";
    s += "\n";
    s += "Anchor\tx\ty\tz\n";
    s += "o\t" + ouv.ox + "\t" + ouv.oy + "\t" + ouv.oz + "\n";
    s += "u\t" + ouv.ux + "\t" + ouv.uy + "\t" + ouv.uz + "\n";
    s += "v\t" + ouv.vx + "\t" + ouv.vy + "\t" + ouv.vz + "\n";
    s += "\n";
    if (atlas.transformations.length === 1) {
        s += "Marker#\tx\ty\t\tnx\tny\tfx\tfy\tfz\n";
        for (var i = 0; i < poi.length; i++) {
            var line = i + 10;
            s += (i + 1) + "\t" + poi[i].x + "\t" + poi[i].y + "\t\t"
                    + "=B" + line + "/$B$2\t=C" + line + "/$C$2\t"
                    + "=B$5+B$6*$E" + line + "+B$7*$F" + line + "\t=C$5+C$6*$E" + line + "+C$7*$F" + line + "\t=D$5+D$6*$E" + line + "+D$7*$F" + line + "\n";
        }
    } else {
        var bak = atlas.transformations.shift();

        for (var i = 0; i < 4; i++) {
            s += "HIDE\t\t\t\t\t\t\t\t";
            for (var t of atlas.transformations)
                s += "\t" + t.matrix[i][0] + "\t" + t.matrix[i][1] + "\t" + t.matrix[i][2];
            s += "\n";
        }

        s += "\t\t\t\t\t\t";
        for (var t of atlas.transformations)
            s += "\t\t\t" + t.name;
        s += "\n";

        s += "Marker#\tx\ty\t\tnx\tny\tfx\tfy\tfz";
        for (var t of atlas.transformations)
            s += "\tx\ty\tz";
        s += "\n";

        atlas.transformations.unshift(bak);

        function idxr(i) {
            var h = Math.floor(i / 26);
            var l = i - h * 26;
            var A = "A".charCodeAt();
            if (h === 0)
                return String.fromCharCode(A + l);
            return String.fromCharCode(A + h - 1) + String.fromCharCode(A + l);
        }

        for (var i = 0; i < poi.length; i++) {
            var line = i + 15;
            s += (i + 1) + "\t" + poi[i].x + "\t" + poi[i].y + "\t\t"
                    + "=B" + line + "/$B$2\t=C" + line + "/$C$2\t"
                    + "=B$5+B$6*$E" + line + "+B$7*$F" + line + "\t=C$5+C$6*$E" + line + "+C$7*$F" + line + "\t=D$5+D$6*$E" + line + "+D$7*$F" + line;
            for (var t = 1; t < atlas.transformations.length; t++)
                s += "\t=$G" + line + "*" + idxr(6 + t * 3) + "$9+$H" + line + "*" + idxr(6 + t * 3) + "$10+$I" + line + "*" + idxr(6 + t * 3) + "$11+" + idxr(6 + t * 3) + "$12\t=$G" + line + "*" + idxr(6 + t * 3 + 1) + "$9+$H" + line + "*" + idxr(6 + t * 3 + 1) + "$10+$I" + line + "*" + idxr(6 + t * 3 + 1) + "$11+" + idxr(6 + t * 3 + 1) + "$12\t=$G" + line + "*" + idxr(6 + t * 3 + 2) + "$9+$H" + line + "*" + idxr(6 + t * 3 + 2) + "$10+$I" + line + "*" + idxr(6 + t * 3 + 2) + "$11+" + idxr(6 + t * 3 + 2) + "$12";
            s += "\n";
        }
    }
    d.write(s);
    d.write("</textarea>Code above can be copied into an Excel sheet<br>Swap decimal dots to commas: <button onclick='swapdots()'>. -> ,</button> and revert: <button onclick='swapcommas()'>, -> .</button></body></html>");
    d.close();
}
function meshview() {
    allpoi[section_id] = poi;
//                let wnd=window.open("https://meshview.apps.hbp.eu?atlas=AMBA_CCFv3_root","MeshView #"+Date.now());
    let wnd = window.open("https://meshview.apps.hbp.eu?atlas=" + (args.atlas.startsWith("WHS") ? "WHS_SD_Rat_v2_39um" : "ABA_Mouse_CCFv3_2015_25um"), "MeshView #" + Date.now());
    let color = document.getElementById("ancolor").value.substring(1);
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    let message = [];
    for (let section of sections) {
        let markers = allpoi[section.id] || [];
        if (markers.length) {
            let triplets = [];
            for (let marker of markers) {
                let nx = marker.x / section.w;
                let ny = marker.y / section.h;
                let x = section.ox + section.ux * nx + section.vx * ny;
                let y = section.oy + section.uy * nx + section.vy * ny;
                let z = section.oz + section.uz * nx + section.vz * ny;
                triplets.push(x, y, z);
            }
            message.push({name: section.id, r, g, b, triplets});
        }
    }
    onmessage = () => {
        wnd.postMessage(message, "*");
    };
    return;
    //var wnd=window.open("about:blank","MeshView #"+Date.now());
    var d = wnd.document;
    d.write("<html><head><title>MeshView export</title><style>textarea{width:100%;height:80%}</style></head><body>");
    d.write("Please copy the coordinates below into <a href='http://www.nesys.uio.no/MeshGen/MeshView.html?bitlas="
            + JSON.parse('{"100000":"ABAMouseHier","200000":"WHSRatV2","300000":"ABAv3-Hier"}')[args.atlas]
            + ".bitlas' target='_blank'>MeshView</a>. Viewer needs Adobe Flash.");
    if (args.atlas === "100000")
        d.write("<br>(Hint: \"Basic cell groups and regions\" is the gray wrapper structure to be switched off)");
    if (args.atlas === "300000")
        d.write("<br>(Hint: \"root\" is the gray wrapper structure to be switched off)");
    d.write("<textarea id='ta'>");
    d.write("RGB 0 0 1\n");
    d.write("SCALE 5\n");
    filmstrip.getmeta().forEach(function (section) {
        var markers = allpoi[section.id] || [];
        if (markers.length) {
            d.write("\n# " + section.name + "\n");
            markers.forEach(function (marker) {
                var nx = marker.x / section.w;
                var ny = marker.y / section.h;
                var x = section.ox + section.ux * nx + section.vx * ny;
                var y = section.oy + section.uy * nx + section.vy * ny;
                var z = section.oz + section.uz * nx + section.vz * ny;
                if (args.atlas === "100000") {
                    y -= 528;
                    z -= 320;
                }
                d.write(x.toFixed(0) + " " + y.toFixed(0) + " " + z.toFixed(0) + "\n");
            });
        }
    });
    d.write("</textarea></body></html>");
    d.close();
}

function metaReady(metahack, callback) {
    loadMarkers(metahack);
    callback();
//                var xhr=new XMLHttpRequest();
//                xhr.open("GET",args.series+".json");
////                xhr.responseType="json";
//                xhr.onload=xhr.onerror=function(){
//                    if(xhr.status===200)
//                        loadMarkers(xhr.responseText);
//                    callback();
//                };
//                xhr.send();
}

function loadMarkers(data) {
    var meta = filmstrip.getmeta();
    allmarkers = {};
    var uglymeta = {};
//                data=JSON.parse(data);
    if (Array.isArray(data)) { // own format
        meta.forEach(function (m) {
            uglymeta[m.id] = m;
            delete m.vam;
        });
        data.forEach(function (section) {
            var id = section.id;
            var meta = uglymeta[id];
            meta.w = section.w;
            meta.h = section.h;
            allmarkers[id] = section.markers;
        });
    } else { // VisuAlign format
        var r = /_s(\d+)/;
        meta.forEach(function (m) {
            uglymeta[m.s/*allnumbered?m.s:m.name*/] = m;
        });
        data.slices.forEach(function (section) {
            var name = section.filename;
            if (name) {
//                        name=name.substring(0,name.lastIndexOf("."));
                //var meta=uglymeta[name];
                var meta = uglymeta[section.hasOwnProperty("nr") ? section.nr : /*allnumbered?*/parseInt(r.exec(name)[1])/*:name.substring(0,name.lastIndexOf("."))*/];
                if (!meta) {
                    var frag = name.substring(0, name.lastIndexOf("."));
                    filmstrip.getmeta().forEach(function (m) {
                        if (m.name.indexOf(frag) >= 0)
                            meta = m;
                    });
                }
                //var meta=uglymeta[allnumbered?parseInt(section.nr):name.substring(0,name.lastIndexOf("."))];
                if (section.markers && meta) {
                    meta.vaw = section.width;
                    meta.vah = section.height;
                    meta.vam = section.markers;
                    var ouv = section.anchoring;
                    meta.ox = ouv[0];
                    meta.oy = ouv[1];
                    meta.oz = ouv[2];
                    meta.ux = ouv[3];
                    meta.uy = ouv[4];
                    meta.uz = ouv[5];
                    meta.vx = ouv[6];
                    meta.vy = ouv[7];
                    meta.vz = ouv[8];
                }
//                            allmarkers[meta.id]=section.markers.map(function(marker){
//                                return {x:marker[0],y:marker[1],nx:marker[2],ny:marker[3]};
//                            });
            }
        });
        visualign();
    }
}

//function visualign() {
//    var hide = false;
//    filmstrip.getmeta().forEach(function (meta) {
//        if (meta.vam) {
//            if (!meta.w)
//                hide = true;
//            else {
//                allmarkers[meta.id] = meta.vam.map(function (marker) {
//                    return {
//                        x: marker[0], //*meta.w/meta.vaw,
//                        y: marker[1], //*meta.h/meta.vah,
//                        nx: marker[2], //*meta.w/meta.vaw,
//                        ny: marker[3]/**meta.h/meta.vah*/};
//                });
//                delete meta.vam;
//            }
//        }
//    });
//    document.getElementById("btn_save").disabled = hide;
//}

function load() {
    var data = prompt("LocaliZoom nonlinear JSON", "");
    if (data === null || data === "")
        return;
    loadMarkers(data);
    markers = allmarkers[section_id] || [];
    triangulate();
    drawImage();
}
//function save() {
////    if (section_id)
////        allmarkers[section_id] = markers;
////    var meta = filmstrip.getmeta();
////    var data = [];
////    meta.forEach(function (section) {
////        var smarkers = allmarkers[section.id];
////        if (smarkers && smarkers.length) {
////            data.push({id: section.id, w: section.w, h: section.h, markers: smarkers});
////        }
////    });
////    var win = window.open("about:blank", "LZSave #" + Date.now());
////    var d = win.document.open();
////    d.write(JSON.stringify(data));
////    d.close();
//    for (let i = 0; i < sries.sections.length; i++)
//        if (sections[i].markers.length)
//            sries.sections[i].markers = sections[i].markers;
//        else
//            delete sries.sections[i].markers;
//}
async function save(event) {
//    for (let i = 0; i < images.length; i++) {
//        let image = images[i];
//        if (image.anchored)
//            series.sections[i].ouv = image.ouv;
//        else
//            delete series.sections[i].ouv;
//    }
////                let upload = await fetch("bucket.php?put=true&filename=" + args.get("filename")).then(response => response.json());
    for (let i = 0; i < sries.sections.length; i++)
        if (sections[i].markers.length)
            sries.sections[i].markers = sections[i].markers;
        else
            delete sries.sections[i].markers;

    let upload = await fetch(`bucket.php?${argspack({filename: args.filename, put: true})}`).then(response => response.json());
    if (!upload.hasOwnProperty("url")) {
        alert("Can't save: " + JSON.stringify(upload));
        return;
    }
    await fetch(upload.url, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(sries)
    });
}


function toggleHelp() {
    var helpstyle = document.getElementById("help").style;
    helpstyle.display = helpstyle.display === "block" ? "none" : "block";
}
//            function toggleTools(){
//                var toolstyle=document.getElementById("toolsinner").style;
//                toolstyle.display=toolstyle.display==="inline-block"?"none":"inline-block";
//            }
function toggleAN() {
    var toolstyle = document.getElementById("antools").style;
    toolstyle.display = toolstyle.display === "inline-block" ? "none" : "inline-block";
}
function toggleNL() {
    var toolstyle = document.getElementById("nltools").style;
    toolstyle.display = toolstyle.display === "inline-block" ? "none" : "inline-block";
}
function handleOvly(event) {
    if (event.target.type === "color")
        document.getElementById("alpha").value = 100;
    triangulate();
    drawImage();
}

function popup(pop) {
    let cover = document.getElementById("cover");
    let popup = document.getElementById("popup");
    cover.hidden = popup.hidden = false;
    cover.style.display = popup.style.display = "block";
    document.getElementById("popcont").innerHTML = pop;
}
function cover() {
    let cover = document.getElementById("cover");
    let popup = document.getElementById("popup");
    cover.hidden = popup.hidden = true;
    cover.style.display = popup.style.display = "none";
}
