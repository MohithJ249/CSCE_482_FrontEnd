import { Alert, Button, FormControl, FormControlLabel, FormLabel, Grid, Paper, Radio, RadioGroup, TextField, Typography, Container, Box, Select, MenuItem, IconButton, Fab } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useCreateScriptMutation } from '../../generated/graphql';
import axios from 'axios';
import { Storage } from 'aws-amplify';
import { ApolloError } from '@apollo/client';
import PDFReader from '../../components/PDFReader';
import OpenAI from "openai";
import { Create, FileUploadOutlined } from '@mui/icons-material';

export default function NewScriptPage() {
    const [title, setTitle] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');
    const [additionalInfo, setAdditionalInfo] = useState<string>('');
    const [speechTime, setSpeechTime] = useState<number>(30);

    const [createScript] = useCreateScriptMutation();
    const [loading, setLoading] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const openai = new OpenAI({
        apiKey: process.env.REACT_APP_API_KEY,
        dangerouslyAllowBrowser: true
    });
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if(title !== '' && prompt !== '') {
            setErrorText(null);

            const content = prompt + ". Make sure to include this information: " + additionalInfo + ". Max limit 128 characters.";
            
            openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: content }],
            })
            .then(response => {
                if (response.choices)
                {
                    createScript({
                        variables: {
                            userid: localStorage.getItem('userid') || '',
                            title: title,
                        }
                    })
                    .then((createScriptResponse) => {
                        const userid = localStorage.getItem('userid');
                        const scriptid = createScriptResponse.data?.createScript?.scriptid;
                        const fileName = "userid-"+userid + "/scriptid-" + scriptid + "/"+title+".txt";
                        const generatedScript = response.choices[0].message.content;

                        Storage.put(fileName, generatedScript, {
                            contentType: 'text/plain',
                        }).then(() => {
                            window.location.href = '/Editing?title=' + title + '&scriptid=' + scriptid;
                        });
                    })
                    .catch((error) => {
                        if(error instanceof ApolloError && error.message.includes('duplicate key value violates'))
                            setErrorText("You already have a script with this title. Please choose a different title.");
                        else
                            setErrorText("Error: "+error.message);
                        setLoading(false);
                    });
                } 
                else {
                    throw new Error('HTTP status is not 200');
                }
            })
            .catch(error => {
                setErrorText("Error: "+error.message)
                setLoading(false);
            });
        }
        else {
            setErrorText("Error: Please fill out all required fields.");
            setLoading(false);
        }
    };

    const handleSubmit2 = async (e: React.FormEvent) => {
        e.preventDefault();

        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Say this is a test" }],
        });
        
        console.log(chatCompletion.choices);
        
    };
    
    const handleExtractedText = (text: string) => {
        setAdditionalInfo(text);
    }

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e);
    }

    const TextfieldStyling = {
        backgroundColor: 'white',
        borderRadius: '15px',
        '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
            borderRadius: '15px',
        },
    };

    const FabStyling = {
        color: 'white',
        backgroundColor: 'black',
        '&:hover': { 
            color: 'white',
            backgroundColor: '#4d4d4d' 
        }
    }

    return (
        <Container component="main" maxWidth="xs">
            <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mt: 8,
            }}
            >

                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ margin: '10px', backgroundColor: '#f1efee' }}>
                    {errorText && <Alert severity="error">{errorText}</Alert>}
                    <TextField
                    variant="outlined"
                    required
                    fullWidth
                    id="title"
                    label="Title"
                    name="title"
                    autoFocus
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    sx={{ margin: 2, width: window.innerWidth * 0.6, ...TextfieldStyling }}
                    />
                    <TextField
                    variant="outlined"
                    required
                    fullWidth
                    name="prompt"
                    label="Prompt"
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='Write a speech about covid'
                    sx={{ margin: 2, width: window.innerWidth * 0.6, ...TextfieldStyling }}
                    />

                    <TextField
                    id="additionalInformation"
                    label="Additional Information"
                    placeholder='List any additional information that you would like to include in your script here'
                    multiline
                    rows={window.innerHeight * 0.8 / 48}
                    variant="outlined"
                    sx={{
                        width: window.innerWidth * 0.6,
                        margin: 2,
                        ...TextfieldStyling
                    }}
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    />

                    <TextField
                        value={speechTime}
                        id='speechTimeSelector'
                        label="Speech Length"
                        select
                        onChange={(e) => setSpeechTime(Number(e.target.value))}
                        sx={{margin: 2, ...TextfieldStyling}}
                    >
                        <MenuItem key={1} value={30}>30 Seconds</MenuItem>
                        <MenuItem key={2}value={60}>1 Minute</MenuItem>
                        <MenuItem key={3} value={120}>2 Minutes</MenuItem>
                        <MenuItem key={4} value={180}>3 Minutes</MenuItem>
                        <MenuItem key={5} value={240}>4 Minutes</MenuItem>
                        <MenuItem key={6} value={300}>5 Minutes</MenuItem>
                    </TextField>

                    <PDFReader getExtractedText={handleExtractedText} addtionalInfo={additionalInfo} onSetAdditionalInfo={setAdditionalInfo} margin={2}/>
                    <Fab
                    type="submit"
                    variant="extended"
                    color="primary"
                    sx={{ mt: 3, mb: 2, width: window.innerWidth * 0.6  }}
                    disabled={loading} onClick={handleSubmit}
                    >
                        <Create />
                        Generate Script
                    </Fab>
                    
                </Box>
            </Box>
        </Container>
    );
}