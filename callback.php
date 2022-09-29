<?php
ob_start();

$token_params = http_build_query(array(
    "grant_type" => "authorization_code",
    "code" => filter_input(INPUT_GET, "code"),
    "redirect_uri" => getenv("ebrains_redirect_lz"),
    "client_id" => getenv("ebrains_id_lz"),
    "client_secret" => getenv("ebrains_secret_lz")
        ));
$token_ch = curl_init(getenv("ebrains_token"));
curl_setopt_array($token_ch, array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $token_params
));
$token_res = curl_exec($token_ch);
curl_close($token_ch);
$token_obj = json_decode($token_res, true);
$token = $token_obj["access_token"];

$json = json_decode(urldecode(filter_input(INPUT_GET, "state")), true);
$json["token"] = $token;

$ch = curl_init(getenv("ebrains_bucket") . $json["clb-collab-id"] . "?delimiter=/");
curl_setopt_array($ch, array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => array(
        "Accept: application/json",
        "Authorization: Bearer " . $token
    )
));
$files = curl_exec($ch);
curl_close($ch);
?>
<!DOCTYPE html>
<html>
    <head>
        <title>TODO supply a title</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>
            let files =<?php echo $files; ?>;
            let state =<?php echo json_encode($json); ?>;
            function startup() {
                let body="";
                for(let object of files.objects)
                    if(object.content_type==="application/json")
                        body+=`<tr><td><a href="#${object.name}" onclick="clicky(event)">${object.name}</a></td><td>${object.bytes}</td><td>${object.last_modified}</td></tr>`;
                document.getElementById("bucket-content").innerHTML=body;
            }
            function clicky(event){
                state.filename=event.target.innerText;
                location.href="filmstripzoom.html?"+encodeURIComponent(JSON.stringify(state));
            }
        </script>
    </head>
    <body onload="startup()">
        <table>
            <thead>
                <tr><th>Filename</th><th>Size</th><th>Modified</th></tr>
            </thead>
            <tbody id="bucket-content"></tbody>
        </table>
    </body>
</html>
