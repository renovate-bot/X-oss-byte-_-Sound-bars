import { Router } from "express";
import { Spotify } from "../spotify/api.js";
import user from "../helper/user.js";
import jwt from "jsonwebtoken";
import music from "../helper/music.js";

const router = Router();

const CheckLogged = (req, res, next) => {
  const { token = null } = req.cookies;
  jwt.verify(token, process.env.JWT_SECRET, async (err, decode) => {
    if (decode?._id?.length === 24) {
      try {
        let userData = await user.get_user(decode?._id);

        if (userData) {
          req.body.userId = userData._id?.toString();
          req.query.userId = userData._id?.toString();
          next();
        }
      } catch (err) {
        console.log(err);
        res.clearCookie("token").status(405).json({
          status: 405,
          message: "User not logged",
        });
      }
    } else if (err) {
      console.log(`Error : ${err?.name}`);
      res.clearCookie("token").status(405).json({
        status: 405,
        message: "User not logged",
      });
    } else {
      res.clearCookie("token").status(405).json({
        status: 405,
        message: "User not logged",
      });
    }
  });
};

router.get("/all", (req, res) => {
  Spotify(async (err, instance) => {
    if (instance) {
      let response;
      try {
        let collection = await instance.get(
          `/search?q=year%3A${new Date().getFullYear()}&type=album%2Cartist%2Ctrack&limit=10&market=ES`
        );

        let collection2 = await instance.get(
          `/search?q=year%3A${new Date().getFullYear()}&type=album%2Ctrack&offset=10&limit=10&market=ES`
        );

        if (collection?.["data"] && collection2?.["data"]) {
          response = {
            tracks: [
              ...(collection?.["data"]?.tracks?.items?.map((obj) => {
                delete obj?.preview_url;
                return obj;
              }) || []),
            ],
            tracks_2: [
              ...(collection2?.["data"]?.tracks?.items?.map((obj) => {
                delete obj?.preview_url;
                return obj;
              }) || []),
            ],
            albums_2: collection2?.["data"]?.albums?.items,
            albums: collection?.["data"]?.albums?.items,
            artists: collection?.["data"]?.artists?.items,
          };
        }
      } catch (err) {
        if (err?.response?.status) {
          return res.status(err?.response?.status).json({
            status: err?.response?.status,
            message: err?.response?.data?.error?.message || "Something Wrong",
          });
        } else {
          return res.status(500).json({
            status: 500,
            message: "Something Wrong",
          });
        }
      } finally {
        if (response) {
          return res.status(200).json({
            status: 200,
            message: "Success",
            data: response,
          });
        }
      }
    } else {
      return res.status(err?.status).json(err);
    }
  });
});

router.get("/search", (req, res) => {
  const {
    search = `year%3A${new Date().getFullYear()}`,
    type,
    offset = 0,
  } = req.query;

  Spotify(async (err, instance) => {
    if (instance) {
      let response;
      try {
        let result = await instance.get(
          `/search?q=${search}&type=${
            type ? type : "album%2Cartist%2Ctrack"
          }&offset=${offset}&limit=${10}&market=ES`
        );

        if (result?.data) {
          if (
            result?.["data"]?.tracks?.items?.[0] ||
            result?.["data"]?.albums?.items?.[0] ||
            result?.["data"]?.artists?.items?.[0]
          ) {
            response = {
              tracks: [
                ...(result?.["data"]?.tracks?.items?.map((obj) => {
                  delete obj?.preview_url;
                  return obj;
                }) || []),
              ],
              albums: result?.["data"]?.albums?.items,
              artists: result?.["data"]?.artists?.items,
              offset: parseInt(offset),
            };
          } else {
            response = {
              empty: true,
              offset: parseInt(offset),
            };
          }
        }
      } catch (err) {
        console.log(err?.response?.status);
        if (err?.response?.status === 400) {
          return res.status(200).json({
            status: 200,
            message: "Success",
            data: {
              [`${type}s`]: [],
              offset:
                parseInt(offset) > 10
                  ? parseInt(offset) - 10
                  : parseInt(offset),
            },
          });
        } else if (err?.response?.status) {
          return res.status(err?.response?.status).json({
            status: err?.response?.status,
            message: err?.response?.data?.error?.message || "Something Wrong",
          });
        } else {
          return res.status(500).json({
            status: 500,
            message: "Something Wrong",
          });
        }
      } finally {
        if (response) {
          return res.status(200).json({
            status: 200,
            message: "Success",
            data: response,
          });
        }
      }
    } else {
      return res.status(err?.status).json(err);
    }
  });
});

router.get("/track", (req, res) => {
  const { id } = req.query;

  Spotify(async (err, instance) => {
    if (instance) {
      let response;

      try {
        let track = await instance.get(`/tracks/${id}?market=ES`);

        if (track?.data?.album?.artists?.[0]?.id) {
          let top = await instance.get(
            `/artists/${track?.data?.album?.artists?.[0]?.id}/top-tracks?market=ES`
          );

          if (top?.data?.tracks && track?.data) {
            response = {
              track: {
                ...track?.data,
                preview_url: null,
              },
              tracks: [
                ...(top?.data?.tracks?.map((obj) => {
                  delete obj?.preview_url;
                  return obj;
                }) || []),
              ],
            };
          }
        }
      } catch (err) {
        if (err?.response?.status) {
          return res.status(err?.response?.status).json({
            status: err?.response?.status,
            message: err?.response?.data?.error?.message || "Something Wrong",
          });
        } else {
          return res.status(500).json({
            status: 500,
            message: "Something Wrong",
          });
        }
      } finally {
        if (response) {
          return res.status(200).json({
            status: 200,
            message: "Success",
            data: response,
          });
        }
      }
    } else {
      return res.status(err?.status).json(err);
    }
  });
});

router.get("/album", (req, res) => {
  const { id } = req.query;

  const { token = null } = req.cookies;

  const getAlbum = () => {
    Spotify(async (err, instance) => {
      if (instance) {
        let response;

        try {
          let album = await instance.get(`/albums/${id}?market=ES`);

          let tracks = await instance.get(
            `/albums/${id}/tracks?market=ES&limit=10&offset=0`
          );

          let related = await instance.get(
            "/browse/new-releases?limit=10&offset=0"
          );

          if (album?.data && tracks?.data && related?.data) {
            delete album?.data?.tracks;

            response = {
              album: album?.data,
              related: related?.data?.albums?.items,
              tracks: [
                ...(tracks?.data?.items?.map((obj) => {
                  delete obj.preview_url;
                  return obj;
                }) || []),
              ],
              offset: 0,
              total: tracks?.data?.total,
            };
          }
        } catch (err) {
          if (err?.response?.status) {
            return res.status(err?.response?.status).json({
              status: err?.response?.status,
              message: err?.response?.data?.error?.message || "Something Wrong",
            });
          } else {
            return res.status(500).json({
              status: 500,
              message: "Something Wrong",
            });
          }
        } finally {
          if (response) {
            return res.status(200).json({
              status: 200,
              message: "Success",
              data: response,
            });
          }
        }
      } else {
        return res.status(err?.status).json(err);
      }
    });
  };

  const getAlbumLogged = (userId) => {
    Spotify(async (err, instance) => {
      if (instance) {
        let response;

        try {
          let album = await instance.get(`/albums/${id}?market=ES`);

          let tracks = await instance.get(
            `/albums/${id}/tracks?market=ES&limit=10&offset=0`
          );

          let related = await instance.get(
            "/browse/new-releases?limit=10&offset=0"
          );

          let inLibrary = await music.checkInLibrary(userId, id, "album");

          if (album?.data && tracks?.data && related?.data) {
            delete album?.data?.tracks;

            response = {
              album: album?.data,
              related: related?.data?.albums?.items,
              tracks: [
                ...(tracks?.data?.items?.map((obj) => {
                  delete obj.preview_url;
                  return obj;
                }) || []),
              ],
              offset: 0,
              total: tracks?.data?.total,
              inLibrary,
            };
          }
        } catch (err) {
          console.log(err);
          if (err?.response?.status) {
            return res.status(err?.response?.status).json({
              status: err?.response?.status,
              message: err?.response?.data?.error?.message || "Something Wrong",
            });
          } else {
            return res.status(500).json({
              status: 500,
              message: "Something Wrong",
            });
          }
        } finally {
          if (response) {
            return res.status(200).json({
              status: 200,
              message: "Success",
              data: response,
            });
          }
        }
      } else {
        return res.status(err?.status).json(err);
      }
    });
  };

  jwt.verify(token, process.env.JWT_SECRET, async (err, decode) => {
    if (decode?._id?.length === 24) {
      try {
        let userData = await user.get_user(decode?._id);

        if (userData) {
          getAlbumLogged(userData?._id?.toString());
        }
      } catch (err) {
        console.log(err);
        getAlbum();
      }
    } else if (err) {
      console.log(`Error : ${err?.name}`);
      getAlbum();
    } else {
      getAlbum();
    }
  });
});

router.get("/album-tracks-more", (req, res) => {
  const { id, offset = 0 } = req.query;

  Spotify(async (err, instance) => {
    if (instance) {
      let response;

      try {
        let tracks = await instance.get(
          `/albums/${id}/tracks?market=ES&limit=10&offset=${offset}`
        );

        if (tracks?.data) {
          response = {
            tracks: [
              ...(tracks?.data?.items?.map((obj) => {
                delete obj.preview_url;
                return obj;
              }) || []),
            ],
            offset: parseInt(offset),
          };
        }
      } catch (err) {
        if (err?.response?.status) {
          return res.status(err?.response?.status).json({
            status: err?.response?.status,
            message: err?.response?.data?.error?.message || "Something Wrong",
          });
        } else {
          return res.status(500).json({
            status: 500,
            message: "Something Wrong",
          });
        }
      } finally {
        if (response) {
          return res.status(200).json({
            status: 200,
            message: "Success",
            data: response,
          });
        }
      }
    } else {
      return res.status(err?.status).json(err);
    }
  });
});

router.get("/artist", (req, res) => {
  const { id } = req.query;

  const { token = null } = req.cookies;

  const getArtist = () => {
    Spotify(async (err, instance) => {
      if (instance) {
        let response;

        try {
          let artist = await instance.get(`/artists/${id}`);

          let tracks = await instance.get(`artists/${id}/top-tracks?market=ES`);

          let related = await instance.get(
            `/artists/${id}/albums?market=ES&limit=10&offset=0`
          );

          if (artist?.data && tracks?.data && related?.data) {
            response = {
              artist: artist?.data,
              related: related?.data?.items,
              tracks: [
                ...(tracks?.data?.tracks?.map((obj) => {
                  delete obj.preview_url;
                  return obj;
                }) || []),
              ],
              offset: 0,
              total: tracks?.data?.total,
            };
          }
        } catch (err) {
          if (err?.response?.status) {
            return res
              .clearCookie("token")
              .status(err?.response?.status)
              .json({
                status: err?.response?.status,
                message:
                  err?.response?.data?.error?.message || "Something Wrong",
              });
          } else {
            return res.clearCookie("token").status(500).json({
              status: 500,
              message: "Something Wrong",
            });
          }
        } finally {
          if (response) {
            return res.clearCookie("token").status(200).json({
              status: 200,
              message: "Success",
              data: response,
            });
          }
        }
      } else {
        return res.clearCookie("token").status(err?.status).json(err);
      }
    });
  };

  const getArtistLogged = (userId) => {
    Spotify(async (err, instance) => {
      if (instance) {
        let response;

        try {
          let artist = await instance.get(`/artists/${id}`);

          let tracks = await instance.get(`artists/${id}/top-tracks?market=ES`);

          let related = await instance.get(
            `/artists/${id}/albums?market=ES&limit=10&offset=0`
          );

          let inLibrary = await music.checkInLibrary(userId, id, "artist");

          if (artist?.data && tracks?.data && related?.data) {
            response = {
              artist: artist?.data,
              related: related?.data?.items,
              tracks: [
                ...(tracks?.data?.tracks?.map((obj) => {
                  delete obj.preview_url;
                  return obj;
                }) || []),
              ],
              inLibrary: inLibrary,
              offset: 0,
              total: tracks?.data?.total,
            };
          }
        } catch (err) {
          console.log(err);
          if (err?.response?.status) {
            return res.status(err?.response?.status).json({
              status: err?.response?.status,
              message: err?.response?.data?.error?.message || "Something Wrong",
            });
          } else {
            return res.status(500).json({
              status: 500,
              message: "Something Wrong",
            });
          }
        } finally {
          if (response) {
            return res.status(200).json({
              status: 200,
              message: "Success",
              data: response,
            });
          }
        }
      } else {
        return res.status(err?.status).json(err);
      }
    });
  };

  jwt.verify(token, process.env.JWT_SECRET, async (err, decode) => {
    if (decode?._id?.length === 24) {
      try {
        let userData = await user.get_user(decode?._id);

        if (userData) {
          getArtistLogged(userData?._id?.toString());
        }
      } catch (err) {
        console.log(err);
        getArtist();
      }
    } else if (err) {
      console.log(`Error : ${err?.name}`);
      getArtist();
    } else {
      getArtist();
    }
  });
});

router.post("/clone-collection-playlist", CheckLogged, async (req, res) => {
  const { userId, ...details } = req.body;

  details.playlistId = `${details?.id}_${details?.type}`;

  let response;

  try {
    response = await music.createPlaylist(userId, details);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: response,
      });
    }
  }
});

router.delete("/delete-playlist", CheckLogged, async (req, res) => {
  const { userId, ...details } = req.body;

  let response;

  try {
    response = await music.deletePlaylist(userId, details);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: response,
      });
    }
  }
});

router.get("/all-playlists", CheckLogged, async (req, res) => {
  const { userId } = req.body;

  let response;

  try {
    response = await music.getAllPlaylist(userId);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: response?.data?.data,
      });
    }
  }
});

export default router;
