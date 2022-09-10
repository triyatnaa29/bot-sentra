const { default: axios } = require("axios");
const { JSDOM } = require("jsdom");

const pinterestHeaders = {
  "sec-ch-ua": '"Chromium";v="90", "Opera GX";v="76", ";Not A Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "upgrade-insecure-requests": "1",
  cookie:
    '_b="AWeC7C4o4LlJyrsUuwSHTcEvFNcFMbqGXHuyBZEMdash+1K/SbsgwV6CezzvAeBHLpM="; _auth=1; _pinterest_sess=TWc9PSZMUEVtdnpseEZMTTNnemxwUWFWc3Rjb3cxQjR1c3NZdWx4ZGtOQnNEc2trZThqN1duUC95andQMEp0ODlRYVk2Y2k2ckFTUTROaE1jeGZXRjM5WExDaGtRRllwcVhMRDRudkdUcGNxWlBkUjlncVJDOW1zekNzTU9iWXRxa0V0WkVYT3kvalpyMEw1S2ZmcmRjYWtvY0xRRkphRWZiWTlISzUyZnBvMDQrNUM1TnNGSGZxL3FYaU1vZXB0UTR3QWZLMGd5VCt2OHRkY3pJL1BXcmdKZURYOHdtNHBTNjMyTHdobnNPNmZDWCtHQUVwMkZJQ05LUUVrZGEvb1R2M0NMc0IzaHRoNGxoN1J6ZThhNGQvN0xHVTJCZUdvUWFWUnJRMU9xcUFXblV6ZGYrWnZoWkc3ZzZOeE52dFVnQ3VudG5WcDdzaDJSMElFK1J4SjlMSXAwVTk2eDU0T1g2V09UYzdBS2ZiQ016aUtsMk1iQWZ5L0cwc0M5L2UvZGlHUndjWGNCbmpPVVRmbjlkWmlRZitNNEtRWEJtWmVKRUtqSHFENWRnQ29RR3Z1QWNUUkNGNk53cHMxY2c3RFc1bVk0RDluSjAySnMxU0R2UVZ1U0xad0FVc2gvMFQ3K1hPT1B5azhWUTB1NkpKN2VUVmxpRVdFUnA3bHNMS0VWZ096L0ZsWE1SREpDVFFxRmk2RUxvcUkvNTl1MmNKQXk5b09KdStnbTVYOFVvdUpMSU4yejhuc1YxNklvL3V3aEtNSzlSeEtheTlFUGNZZUdhN0pHb3pYOEk2SGRvdWhFSjlQNEw5NlBoU0d0STlkQVlrd2g3VVB0dCt4TFlmMzB3TlhvbU5KR2Jpck4yWE5nK2VDOUphMGtvSC8rV3ArT0VrWTI0dm5vUmlNSy9PcnFrSk9VYUZzbVpKTFJXdktnNGxuTjQ4UFUremFEUUkvTmIwTFZnckFSSFE4RGpvMUZpVVZScGMrTEtRQ0pXTjhISHJaa25IZHZwV1pPclA4VGFEeDNIVVpHb09ISmprVy9RZFBISHRmLytRPT0mMmxJYmtVTjVZTVZaZXF4aHpSZ2ZpdVE3TVBZPQ==; csrftoken=8eeb53d38c692a40d72b79e65ebdc72a; _routing_id="3b3098c9-425b-4563-81bb-162d03743715"; sessionFunnelEventLogged=1',
};

exports.pinterest = {
  search: async (query) => {
    try {
      const { data } = await axios.get(
        `https://id.pinterest.com/search/pins/?q=` +
          encodeURIComponent(query) +
          "&rs=typo_auto_original&auto_correction_disabled=true",
        { headers: pinterestHeaders }
      );
      const dom = new JSDOM(data).window.document;
      let json = JSON.parse(dom.getElementById("__PWS_DATA__").innerHTML);
      let array = Object.keys(json.props.initialReduxState.pins);

      let asu = [];
      for (let i = 0; i < array.length; i++) {
        let data = json.props.initialReduxState.pins[array[i]];
        asu.push({
          title: data.title,
          media: data.images.orig,
          created_at: data.created_at,
          id: data.id,
        });
      }
      return asu;
    } catch (error) {
      return error;
    }
  },
  download: async (url) => {
    try {
      const uri = await axios.get(url).then((res) => {
        let nganu = new URL(res.request.res.responseUrl);
        pathname = nganu.pathname;
        return nganu.origin + pathname.slice(0, pathname.lastIndexOf("/"));
      });
      const { data } = await axios.get(uri, { headers: pinterestHeaders });
      const dom = new JSDOM(data).window.document;
      let re = JSON.parse(dom.getElementById("__PWS_DATA__").innerHTML);
      const json =
        re.props.initialReduxState.pins[
          Object.keys(re.props.initialReduxState.pins)
        ];
      let result = {
        title: json.title,
        media:
          json.videos !== null
            ? json.videos.video_list[
                Object.getOwnPropertyNames(json.videos.video_list)[0]
              ]
            : json.images.orig,
        extension: json.videos !== null ? "mp4" : "jpg",
        created_at: json.created_at,
        id: json.id,
        ...json,
      };
      return result;
    } catch (error) {
      return error;
    }
  },
};
