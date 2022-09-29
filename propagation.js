//function clearpropagation(sections) {
//    for (let section of sections) {
//        delete section.snr;
//        if (section.anchored) {
//            delete section.ouv;
//            delete section.anchored;
//        }
//    }
//}

function propagate(sections, atlas) {
    let anchoring = false;
    for (let section of sections) {
//        if (!section.hasOwnProperty("snr"))
//            section.snr = parseInt(section.filename.match(/(?<=_s)\d+/));
//        if (!section.hasOwnProperty(("anchored")))
//            section.anchored = section.hasOwnProperty("ouv");
        if (section.anchored === true) {
            if (anchoring === false)
                anchoring = section;
            else
                anchoring = true;
        }
    }
    if (anchoring === false) {
        let keyslice = sections[Math.min(sections.length - 1, (sections.length >> 1) + 1)];
        let ouv = [0, atlas.ydim / 2, atlas.zdim - 1,
            atlas.xdim, 0, 0,
            0, 0, -atlas.zdim
        ];
        decomp(ouv, keyslice.width, keyslice.height);
        for (let section of sections)
            recomp(section.ouv = ouv.slice(), section.width, section.height);
    } else if (anchoring !== true) {
        let ouv = anchoring.ouv;
        decomp(ouv, anchoring.width, anchoring.height);
        for (let section of sections)
            recomp(section.ouv = ouv.slice(), section.width, section.height);
    } else {
        let linregs = [];
        for (let i = 0; i < 11; i++)
            linregs.push(new LinReg());
        for (let section of sections)
            if (section.anchored) {
                let ouv = section.ouv;
                decomp(ouv, section.width, section.height);
                for (let i = 0; i < ouv.length; i++)
                    linregs[i].add(section.snr, ouv[i]);
            }
        let clearfirst = false;
        let clearlast = false;
        if (!sections[0].anchored) {
            let section = sections[0];
            let w = [];
            for (let linreg of linregs)
                w.push(linreg.get(section.snr));
            orthonormalize(w);
            section.ouv = w;
            section.anchored = clearfirst = true;
        }
        if (!sections[sections.length - 1].anchored) {
            let section = sections[sections.length - 1];
            let w = [];
            for (let linreg of linregs)
                w.push(linreg.get(section.snr));
            orthonormalize(w);
            section.ouv = w;
            section.anchored = clearlast = true;
        }
        let start = 0;
        while (start < sections.length - 1) {
            let end = start + 1;
            while (!sections[end].anchored)
                end++;
            if (end > start + 1) {
                let si = sections[start];
                let ssnr = si.snr;
                let souv = si.ouv;
                let ei = sections[end];
                let esnr = ei.snr;
                let eouv = ei.ouv;
                let linints = [];
                for (let i = 0; i < 11; i++)
                    linints.push(new LinInt(ssnr, souv[i], esnr, eouv[i]));
                for (let j = start + 1; j < end; j++) {
                    let section = sections[j];
                    let snr = section.snr;
                    let w = [];
                    for (let linint of linints)
                        w.push(linint.get(snr));
                    orthonormalize(w);
                    section.ouv = w;
                }
            }
            start = end;
        }
        if (clearfirst)
            sections[0].anchored = false;
        if (clearlast)
            sections[sections.length - 1].anchored = false;
        for (let section of sections)
            recomp(section.ouv, section.width, section.height);
    }
}

function decomp(ouv, width, height) {
    if (typeof width === "undefined") {
        width = height = 1;
    }
    let u = 0;
    let v = 0;
    for (let i = 0; i < 3; i++) {
        ouv[i] += (ouv[i + 3] + ouv[i + 6]) / 2;
        u += ouv[i + 3] * ouv[i + 3];
        v += ouv[i + 6] * ouv[i + 6];
    }
    u = Math.sqrt(u);
    v = Math.sqrt(v);
    for (let i = 0; i < 3; i++) {
        ouv[i + 3] /= u;
        ouv[i + 6] /= v;
    }
    ouv.push(u / width, v / height);
}
function recomp(ouv, width, height) {
    if (typeof width === "undefined") {
        width = height = 1;
    }
    let v = ouv.pop() * height;
    let u = ouv.pop() * width;
    for (let i = 0; i < 3; i++) {
        ouv[i + 3] *= u;
        ouv[i + 6] *= v;
        ouv[i] -= (ouv[i + 3] + ouv[i + 6]) / 2;
    }
}

function normalize(arr, idx) {
    let len = 0;
    for (let i = 0; i < 3; i++)
        len += arr[idx + i] * arr[idx + i];
    len = Math.sqrt(len);
    for (let i = 0; i < 3; i++)
        arr[idx + i] /= len;
    return len;
}

function orthonormalize(ouv) {
    normalize(ouv, 3);
    let dot = 0;
    for (let i = 0; i < 3; i++)
        dot += ouv[i + 3] * ouv[i + 6];
    for (let i = 0; i < 3; i++)
        ouv[i + 6] -= ouv[i + 3] * dot;
    normalize(ouv, 6);
}

function LinInt(x1, y1, x2, y2) {
    this.get = function (x) {
        return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
    };
}

function LinReg() {
    let n = 0;
    let Sx = 0;
    let Sy = 0;
    let Sxx = 0;
    let Sxy = 0;
    let a, b;
    this.add = function (x, y) {
        n++;
        Sx += x;
        Sy += y;
        Sxx += x * x;
        Sxy += x * y;
        if (n >= 2) {
            b = (n * Sxy - Sx * Sy) / (n * Sxx - Sx * Sx);
            a = Sy / n - b * Sx / n;
        }
    };
    this.get = function (x) {
        return a + b * x;
    };
}
