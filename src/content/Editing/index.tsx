import { Button, Grid, Grow, Paper, TextField, Typography, recomposeColor } from '@mui/material';
import { ReactMediaRecorder, ReactMediaRecorderRenderProps } from 'react-media-recorder';
import { useParams } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { preProcessFile } from 'typescript';
import { Storage } from 'aws-amplify';
import AudioRecorder from './audio';

export default function EditingPage() {
    const [title, setTitle] = useState<string | null>(null);
    const [scriptid, setScriptid] = useState<string | null>(null);
    const [scriptContent, setScriptContent] = useState<string | undefined>(undefined);

    function populateScriptContent() {
        const userid = localStorage.getItem('userid');
        const fileName = "userid-"+userid+ "/scriptid-" + scriptid + "/"+title+".txt";

        Storage.get(fileName, { download: true })
            .then(fileContent => {
                return fileContent.Body?.text();
            })
            .then(textContent => {
                console.log('Text Content:', textContent);
                setScriptContent(textContent || '');
            })
            .catch(error => {
                console.error('Error downloading file:', error);
        });      
    }
      
    useEffect(() => {
        const url = window.location.search;
        const searchParams = new URLSearchParams(url);
        setTitle(searchParams.get('title'));
        setScriptid(searchParams.get('scriptid'));
    }, []);

    useEffect(() => {
        if(title && scriptid)
            populateScriptContent();
    }, [title, scriptid]);

    return (
        <>
            <div>
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
                                            <AudioRecorder />
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