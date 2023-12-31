import React, { useState, useEffect, useRef } from 'react';
import { Storage } from 'aws-amplify';
import { Box, IconButton, Input, Paper, Slider, Stack, Tooltip, Typography, styled  } from '@mui/material';
import { Pause, PlayArrow, Save, VolumeUp, VolumeDown, RadioButtonChecked } from '@mui/icons-material';
import { useSaveRecordingMutation } from '../generated/graphql';

interface AudioRecorderProps {
  scriptid: string;
  scriptTitle?: string;
  onShowNotification: (severity: 'success' | 'info' | 'warning' | 'error', text: string) => void;
  mode: 'Editing' | 'Viewing'; // because this component can be used to make new recordings or view existing recordings. 
  recordingTitle?: string;
  viewingAudioUrl?: string;   // when in viewing mode, just need to retrieve urls to replay; no need to save new recordings
}
  // styling audio player 
interface sliderProps {
  theme?: any;
  thumbless?: boolean;
}

// styling for slider must stay outside the function to have the slider change smoothly
const PlayBar = styled(Slider)<sliderProps>(({ theme, ...otherProps }) => ({
  color: 'black',
  height: 2,
  '&:hover': {
    cursor: 'auto',
  },
  '& .MuiSlider-thumb': {
    color: 'black',
    width: '14px',
    height: '14px',
    display: otherProps.thumbless ? 'none' : 'block',
    '&:before': {
      display: 'none',
    },
  }
}))

function AudioRecorder({ scriptid, scriptTitle, onShowNotification, mode, recordingTitle, viewingAudioUrl }: AudioRecorderProps) {
  // for audio player
  const [stream, setStream] = useState<MediaStream>();
  const [recording, setRecording] = useState(false);
  const [recordingName, setRecordingName] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>();
  const mediaRecorderRef = useRef<MediaRecorder>();
  const audioChunks = useRef<Blob[]>([]);
  const [saveRecordingInDatabase, { loading, error }] = useSaveRecordingMutation();
  const audioRef = useRef<HTMLAudioElement>(null);

  // for recorder component
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState(70);


  // when recorder is in viewing mode, set the audio url of the selected recording
  // to play back the right recording
  useEffect(() => {
    if (mode==='Viewing' && viewingAudioUrl !== undefined && viewingAudioUrl !== '') {
      setAudioUrl(viewingAudioUrl);
      if(audioRef.current)
        audioRef.current.src = viewingAudioUrl;
    } 
    else if(mode === 'Viewing') {
      setAudioUrl(viewingAudioUrl);
      if(audioRef.current)
        audioRef.current.src = '';
      setDuration(0);
      setElapsed(0);
    }
  }, [viewingAudioUrl]);
  
  // to start and stop the recording
  useEffect(() => {
    if (recording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [recording]);

  // to get the duration of the recording
  var getDuration = function (url: any, next: any) {
    var _player = new Audio(url);
    _player.addEventListener("durationchange", function (e) {
        if (this.duration!=Infinity) {
           var duration = this.duration
           _player.remove();
           next(duration);
        };
    }, false);      
    _player.load();
    _player.currentTime = 24*60*60;
    _player.volume = 0;
};

  // whenever the audio url changes, then the recording changed, so update duration
  useEffect(() => {
    getDuration (audioUrl, function (duration: any) {
      setDuration(duration)
  });
  }, [audioUrl]);

  // to format the elapsed and duration times in minutes and seconds properly on the recorder component
  const formatTime = (time: number) => {
    if(time && !isNaN(time) && isFinite(time)) {
      const minutes = Math.floor(time / 60) < 10 ? `0${Math.floor(time / 60)}` : Math.floor(time / 60);
      const seconds = Math.floor(time % 60) < 10 ? `0${Math.floor(time % 60)}` : Math.floor(time % 60);

      return `${minutes}:${seconds}`;
    }
    return "00:00";
  }

  const startRecording = async () => {
    try {
        audioChunks.current = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(stream);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) {
                audioChunks.current.push(e.data);
            }
        };

        // when done recording, set the blob and url created, so the recording can be accessed
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
            const newURL = URL.createObjectURL(audioBlob);
            setAudioUrl(newURL);
            
            if(audioRef.current && newURL) {
              audioRef.current.src = newURL;
            }
        };

        mediaRecorderRef.current.start();
    } catch (error) {
        console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if(stream)
        stream.getTracks().forEach((track) => track.stop());
    }
  };

  const saveRecording = () => {
    if(recordingName) {
      // First save recording to database to ensure no duplicate names
      saveRecordingInDatabase({
        variables: {
          scriptid: scriptid,
          title: recordingName,
        }
      }).then(() => {
        // Save recording to S3
        const userid = localStorage.getItem('userid');
        const fileName = "userid-"+userid+ "/scriptid-" + scriptid + "/recordings/"+recordingName+".wav";
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        Storage.put(fileName, audioBlob, {
          contentType: 'audio/wav',
          level: 'public',
        }).then(() => {
          setRecordingName('');
          setAudioUrl('');   
          setDuration(0);      
          setElapsed(0);
          onShowNotification('success', 'Recording saved successfully.'); 
        }).catch((error) => {
          onShowNotification('error', 'Error saving recording: ' + error.message);
        });
      }).catch((error) => {
        if(error.message.includes('duplicate key value violates unique constraint "uq_scriptid_title"'))
          onShowNotification('error', 'A recording with that name already exists. Please choose a different name.');
      });
    }
  }

  // for error handling and to avoid saving an empty recording or a recording with an empty name
  const saveRecordingDisabled = () => {
    return !audioUrl || recordingName === undefined || recordingName === '' || loading;
  }

  // to control the volume of the recording
  const handleVolume = (e: Event, newValue: number | number[]): void => {
    // const { value } = e.target;
    let currVolume = Number(newValue);
    if(audioRef.current) {
      audioRef.current.volume = currVolume / 100;
      setVolume(currVolume);
    }
  }
  
  // allows to play and pause the audio as needed
  const togglePlay = () => {
    if(!isPlaying && audioUrl) {
      audioRef.current?.play();
      setIsPlaying(true);
    }
    else if(isPlaying && audioUrl) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };
  
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setElapsed(audioRef.current.currentTime);
    }
  };
  
  const styledPaper = {
    backgroundColor: '#edf2fa',
    padding: '20px',
    borderRadius: '15px',
  };

  // want to include the record button only for editing page. When in viewing mode, do not include anything
  const getRecordButton = () => {
    if(mode==='Editing') {
      return (
                <Tooltip title="Record">
                <RadioButtonChecked sx={{
                  color: recording ? 'red' : 'black',
                  '&:hover': recording ? { color: '#ff7276' } : {color: '#808080'}
                }}
                onClick={() => setRecording(!recording)}/>
              </Tooltip>
              )
    }
    else 
      return <></>
    }


    // want to include the save button only for editing page. When in viewing mode, do not include anything
    const getSaveButton = () => {
      if(mode === 'Editing') {
        return (
          <Tooltip title="Save">
            <span>
              <IconButton onClick={audioUrl !== undefined ? saveRecording : undefined} sx ={{'&:hover': {
                backgroundColor: 'transparent',
              }}}>
                <Save sx={{color:'black', '&:hover': {color: '#808080'}}} onClick={() => {
                  if(saveRecordingDisabled()) {
                    onShowNotification('error', 'Either the recording or the name for it does not exist.');
                  }
                }}/>
              </IconButton>
            </span>
          </Tooltip>
        );
      }
      else {
        return <></>
      }
  }

  // change the icon as the audio is playing or paused
  const getPlayButton = () => {
    return (
        <Tooltip title="Play/Pause">
        {!isPlaying ? (<PlayArrow onClick={togglePlay} sx={{
                      fontSize: '80px',
                      color:'black',
                      '&:hover': {color: '#808080'}}}
                    />)
                    : (<Pause onClick={togglePlay} sx={{
                      fontSize: '80px',
                      color:'black',
                      '&:hover': {color: '#808080'}}}/>)
                    }
      </Tooltip>
    )
  }
  
  return (
    <>
      <Paper sx={styledPaper}>
        <Stack direction='row' spacing={1} sx={{
          justifyContent: 'center'}}>
          {mode === 'Editing' ? (<Input 
          placeholder="Recording Name *" sx={{ color: 'black', 
          '& .MuiInputBase-input::placeholder': {
              color: 'black',
              opacity: 1
            },
            ':before': { borderBottomColor: 'black' },
            // underline when selected
            ':after': { borderBottomColor: 'black' },

            }} 
          value={recordingName} 
          onChange={(e) => {
            setRecordingName(e.target.value)}
          }   />)
          : 
          (<Typography sx={{color: 'black'}}>{recordingTitle}</Typography>)

          }
        </Stack>
        <Box sx={{display: 'flex', justifyContent: 'center'}}>
          <Stack direction='row' spacing={1}
            sx={{
              display : 'flex',
              justifyContent: 'center',
              width: '40%',
              alignItems: 'center',
            }}>
              {getRecordButton()}      
              {getPlayButton()}
              {getSaveButton()}
          </Stack>
        </Box>
        <Stack spacing={1} direction='row' sx={{
          display : 'flex',
          width: '100%',
          alignItems: 'center',
        }}>
          <Typography sx={{color: 'black'}}>{formatTime(elapsed)}</Typography>
          <PlayBar thumbless value={elapsed} max={duration} onChange={(e, newValue) => {
            if(audioRef.current)
              audioRef.current.currentTime = newValue as number;
          }
          }/>
          <Typography sx={{color: 'black'}}>{formatTime(duration - elapsed)}</Typography>
        </Stack>
        <div style={{justifyContent: "center"}}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center'  }}>
            <Stack direction='row' spacing={1}
                sx={{
                  display : 'flex',
                  justifyContent: 'flex-start',
                  width: '70%',
                  alignItems: 'center',
                }}>         
                <VolumeDown sx={{color: 'black'}}/>
                <PlayBar
                  min={0}
                  max={100}
                  value={volume}
                  onChange={handleVolume}
                  />
                <VolumeUp sx={{color: 'black'}}/>
            </Stack>
          </Box>
        </div>
        <audio 
          className='my-audio' 
          src={audioUrl}
          ref={audioRef} 
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}></audio>
      </Paper>
    </>
  );
}

export default AudioRecorder;