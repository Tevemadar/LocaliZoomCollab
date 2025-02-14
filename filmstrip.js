const fs_data = {
    canvaswidth: 0,
    canvasheight: 0,
    pos: 0,
    start: 0,
    end: -1,
    alpha: 0.3,
    idx: 0
};

function fs_setwidth(width) {
    fs_data.canvaswidth = width;
    fs_redraw();
    return width;
}

function fs_setheight(height) {
    fs_data.canvasheight = height;
    fs_redraw();
    return height;
}

function fs_start() {
    fs_data.idx = Math.floor(sections.length / 2);
    fs_data.pos = Math.max(0, fs_data.idx * 160 - fs_data.canvaswidth / 2 + 72);
    dispatchSection(sections[fs_data.idx]);

    fs_redraw();
}

function fs_prev() {
    if (fs_data.idx > 0) {
        fs_data.idx--;
        fs_data.pos = Math.max(0, fs_data.idx * 160 - fs_data.canvaswidth / 2 + 72);
        dispatchSection(sections[fs_data.idx]);
        fs_redraw();
    }
}
function fs_next() {
    if (fs_data.idx < sections.length - 1) {
        fs_data.idx++;
        fs_data.pos = Math.max(0, fs_data.idx * 160 - fs_data.canvaswidth / 2 + 72);
        dispatchSection(sections[fs_data.idx]);
        fs_redraw();
    }
}

function fs_setalpha(newalpha) {
    fs_data.alpha = newalpha;
}

function fs_redraw() {
    if (!atlas)
        return;
    fs_data.start = Math.floor((fs_data.pos - 128) / 160);
    if (fs_data.start < 0)
        fs_data.start = 0;
    fs_data.end = Math.floor((fs_data.pos + (fs_data.canvaswidth - 20)) / 160);
    if (fs_data.end >= sections.length)
        fs_data.end = sections.length - 1;
    var ctx = document.getElementById("scroller").getContext("2d");
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, fs_data.canvaswidth, fs_data.canvasheight);
    for (var x = fs_data.start; x <= fs_data.end; x++) {
        let item = sections[x];
        let ovly = item.ovly;
        if (!ovly) {
            ovly = item.ovly = slice(item.ouv);
        }
        ctx.globalAlpha = 1;
        if (fs_data.idx === x) {
            ctx.fillStyle = "#00FF00";
            ctx.fillRect(x * 160 - fs_data.pos + 20 - 10, 20, 128 + 10 + 10, 128);
        }
        let icon = item.icon;
        if (!icon) {
            let level = 0, w = item.width, h = item.height, s = item.tilesize;
            while (w >= s || h >= s) {
                level++;
                w = (w + 1) >> 1;
                h = (h + 1) >> 1;
            }
//            let img = document.createElement("img");
//            img.onload = function (event) {
//                item.icon = img;
//                fs_redraw();
//            };
//            img.src = locators.TileLocator(item.id, maxlevel - level, 0, 0, doc.getAttribute("Format"));
            getTile(item, item.maxlevel - level, 0, 0).then(tile => {
                item.icon = tile;
                fs_redraw();
            })
            item.icon = true;
        }
//        if (item.icon === null) {
//            item.icon = new XMLHttpRequest();
//            item.icon.open("GET", locators.DZILocator(item.id));
//            item.icon.onload = function (event) {
//                var doc = new DOMParser().parseFromString(event.target.responseText, "text/xml").documentElement;
//                var tilesize = parseInt(doc.getAttribute("TileSize"));
//                var size = doc.getElementsByTagName("Size").item(0);
//                var width = parseInt(size.getAttribute("Width"));
//                var height = parseInt(size.getAttribute("Height"));
//                var w = width, h = height, maxlevel = 0;
//                while (w > 1 || h > 1) {
//                    w = (w + 1) >> 1;
//                    h = (h + 1) >> 1;
//                    maxlevel++;
//                }
//                var level = 0;
//                while (width >= tilesize || height >= tilesize) {
//                    level++;
//                    width = (width + 1) >> 1;
//                    height = (height + 1) >> 1;
//                }
//                var img = document.createElement("img");
//                img.onload = function (event) {
//                    item.icon = img;
//                    fs_redraw();
//                };
//                img.src = locators.TileLocator(item.id, maxlevel - level, 0, 0, doc.getAttribute("Format"));
//            };
//            item.icon.send();
//        }
        if (icon instanceof HTMLImageElement) {
            if (icon.width >= icon.height) {
                ctx.drawImage(icon, x * 160 - fs_data.pos + 20, 20, 128, 128 * icon.height / icon.width);
                ctx.globalAlpha = fs_data.alpha;
                ctx.drawImage(ovly, x * 160 - fs_data.pos + 20, 20, 128, 128 * icon.height / icon.width);
            } else {
                ctx.drawImage(icon, x * 160 - fs_data.pos + 20, 20, 128 * icon.width / icon.height, 128);
                ctx.globalAlpha = fs_data.alpha;
                ctx.drawImage(ovly, x * 160 - fs_data.pos + 20, 20, 128 * icon.width / icon.height, 128);
            }
        } else {
            if (ovly.width >= ovly.height)
                ctx.drawImage(ovly, x * 160 - fs_data.pos + 20, 20, 128, 128 * ovly.height / ovly.width);
            else
                ctx.drawImage(ovly, x * 160 - fs_data.pos + 20, 20, 128 * ovly.width / ovly.height, 128);
        }
    }
    ctx.clearRect(0, 0, 20, 128 + 20);
    ctx.lineStyle = "black";
    ctx.fillStyle = "#0000FF";
    ctx.globalAlpha = 1;
    ctx.strokeRect(0, Math.round(20 + 118 * fs_data.alpha) + 0.5, 20, 10);
    ctx.clearRect(0, 0, fs_data.canvaswidth, 20);
    ctx.strokeRect(20, 0, fs_data.canvaswidth - 20, 20);
    var len = sections.length * 160 - 34;
    ctx.fillRect(20 + fs_data.pos * (fs_data.canvaswidth - 20) / len, 0, (fs_data.canvaswidth - 20) * (fs_data.canvaswidth - 20) / len, 20);
}

function fs_mwheel(event) {
    if (event.offsetX < 20) {
        fs_data.alpha += event.deltaY > 0 ? 0.05 : -0.05;
        fs_data.alpha = Math.max(0, Math.min(1, fs_data.alpha));
    } else {
        fs_data.pos += event.deltaY < 0 ? 100 : -100;
        fs_data.pos = Math.max(0, Math.min(fs_data.pos, sections.length * 160 - fs_data.canvaswidth - 34 + 20));
    }
    fs_redraw();
}

function fs_mclick(event) {
    if (event.offsetX < 20) {
        if (event.offsetY < 20) {
            fs_data.alpha = fs_data.alpha === 0 ? 1 : 0;
        } else {
            fs_data.alpha = (event.offsetY - 20) / 118;
        }
        fs_redraw();
        return;
    }
    if (event.offsetY < 20) {
        var len = sections.length * 160 - 34;
        fs_data.pos = (event.offsetX - 20 - (fs_data.canvaswidth - 20) * (fs_data.canvaswidth - 20) / len / 2) * len / (fs_data.canvaswidth - 20);
        fs_data.pos = Math.max(0, Math.min(fs_data.pos, sections.length * 160 - fs_data.canvaswidth - 34 + 20));
        fs_redraw();
        return;
    }
    fs_data.idx = Math.floor((fs_data.pos + event.offsetX - 20 + (160 - 128) / 2) / 160);
    dispatchSection(sections[fs_data.idx]);
    fs_redraw();
}
