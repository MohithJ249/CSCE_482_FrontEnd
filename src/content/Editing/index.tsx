import { Button, Grid, Grow, Paper, TextField, Typography, recomposeColor, Snackbar, Alert } from '@mui/material';
import { ReactMediaRecorder, ReactMediaRecorderRenderProps } from 'react-media-recorder';
import { useParams } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { preProcessFile } from 'typescript';
import { Storage } from 'aws-amplify';
import AudioRecorder from '../../components/AudioRecorder';

import MakeVersionButton from '../../components/MakeVersionButton';

export default function EditingPage() {
    const [title, setTitle] = useState<string>();
    const [scriptid, setScriptid] = useState<string>();
    const [scriptContent, setScriptContent] = useState<string>();
    const [isSavingScript, setIsSavingScript] = useState<boolean>(false);
    const [notificationText, setNotificationText] = useState<string>();
    const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
    const [notificationSeverity, setNotificationSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('success');

    // Add ctrl+s shortcut to save script
    useEffect(() => {
        const handleSave = (e: any) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveScript();
          }
        };
    
        document.addEventListener('keydown', handleSave);
    
        return () => {
          document.removeEventListener('keydown', handleSave);
        };
      }, [scriptContent]);
      
    useEffect(() => {
        const url = window.location.search;
        const searchParams = new URLSearchParams(url);
        setTitle(searchParams.get('title') || undefined);
        setScriptid(searchParams.get('scriptid') || undefined);
    }, []);

    useEffect(() => {
        if(title && scriptid)
            populateScriptContent();
    }, [title, scriptid]);

    const saveScript = () => {
        if(!isSavingScript) {
            setIsSavingScript(true);
            const userid = localStorage.getItem('userid');
            const fileName = "userid-"+userid+ "/scriptid-" + scriptid + "/"+title+".txt";
            Storage.put(fileName, scriptContent || '', {
                contentType: 'text/plain'
            }).then(() => {
                showNotification('success', 'Script saved successfully!');
            }).catch(() => {
                showNotification('error', 'Error saving script, please try again.');
            }).finally(() => {
                setIsSavingScript(false);
            });
        }
    }

    const showNotification = (severity: 'success' | 'info' | 'warning' | 'error', text: string) => {
        setNotificationSeverity(severity);
        setNotificationText(text);
        setIsNotificationOpen(true);
    }

    const populateScriptContent = () => {
        const userid = localStorage.getItem('userid');
        const fileName = "userid-"+userid+ "/scriptid-" + scriptid + "/"+title+".txt";

        Storage.get(fileName, { download: true })
            .then(fileContent => {
                return fileContent.Body?.text();
            })
            .then(textContent => {
                setScriptContent(textContent || '');
            })
            .catch(error => {
                console.error('Error downloading file:', error);
        });      
    }

    if(scriptid && title !== undefined && scriptContent !== undefined) {
        return (
            <>
                <div>
                    <Snackbar open={isNotificationOpen} autoHideDuration={6000} onClose={()=>setIsNotificationOpen(false)}>
                        <Alert onClose={()=>setIsNotificationOpen(false)} severity={notificationSeverity} sx={{ width: '100%' }}>
                            {notificationText}
                        </Alert>
                    </Snackbar>
                    <Typography variant="h3">Script: {title}</Typography>

                    <div style={{ flexGrow: 1 }}>
                        <Grid sx={{ flexGrow: 1 }} container spacing={2}>
                            <Grid item xs={12}>
                                <Grid container justifyContent="center" spacing={2}>
                                    <Grow in key='RecordingPane' timeout={1000}>
                                        <Grid item>
                                            <Paper
                                                sx={{
                                                height: window.innerHeight * 0.8,
                                                width: window.innerWidth * 0.2,
                                                backgroundColor: '#eeeeee',
                                                }}
                                            >
                                                
                                                <AudioRecorder scriptid={scriptid}/>
                                                <Button onClick={saveScript} disabled={isSavingScript}>
                                                    Save Script
                                                </Button>
                                                <MakeVersionButton scriptid={scriptid} scriptContent={scriptContent} onShowNotification={showNotification} />
                                            </Paper>
                                        </Grid>
                                    </Grow>

                                    <Grow in key='EditingPane' timeout={1500}>
                                        <Grid item>
                                            <TextField
                                            id="outlined-multiline-static"
                                            multiline
                                            // height of 1 row = 56px, so adjust accordingly
                                            rows={window.innerHeight * 0.8 / 24}
                                            variant="outlined"
                                            sx={{
                                                height: window.innerHeight * 0.8,
                                                width: window.innerWidth * 0.6,
                                            }}
                                            value={scriptContent}
                                            onChange={(e) => setScriptContent(e.target.value)}
                                            />
                                        </Grid>
                                    </Grow>
                                </Grid>
                            </Grid>
                        </Grid>
                    </div>
                </div>
            </>
        );
    }
    else {
        return <></>
    }
}