import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import videoService from '../services/videoService';
import VideoPreview from './VideoPreview';
import '../styles/animations.css';
import TemplateManager from './TemplateManager';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const steps = ['Upload Media', 'Add Hook & Text', 'Generate Videos'];

const fontOptions = [
  'Arial',
  'Roboto',
  'Montserrat',
  'Open Sans',
  'Poppins',
  'TikTok Sans',
];

const textAnimations = [
  'Fade In',
  'Slide Up',
  'Slide Down',
  'Pop',
  'Bounce',
  'Type',
];

const textColors = [
  '#FFFFFF',
  '#000000',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
];

function VideoCreator() {
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState({
    mainVideo: null,
    secondaryVideos: [],
    hooks: null,
    music: null,
  });
  
  const [textSettings, setTextSettings] = useState({
    selectedFonts: ['Arial'],
    textColor: '#FFFFFF',
    textSize: 48,
    textAnimation: 'Fade In',
    textPosition: 'center',
    duration: {
      part1: 10,
      part2: 10,
    },
    useAllFonts: false,
  });

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleFileUpload = (type, event) => {
    const uploadedFiles = event.target.files;
    if (type === 'mainVideo') {
      setFiles({ ...files, mainVideo: uploadedFiles[0] });
    } else if (type === 'secondaryVideos') {
      setFiles({ ...files, secondaryVideos: Array.from(uploadedFiles) });
    } else if (type === 'hooks') {
      setFiles({ ...files, hooks: uploadedFiles[0] });
    } else if (type === 'music') {
      setFiles({ ...files, music: uploadedFiles[0] });
    }
  };

  const handleFontToggle = (font) => {
    if (textSettings.selectedFonts.includes(font)) {
      setTextSettings({
        ...textSettings,
        selectedFonts: textSettings.selectedFonts.filter((f) => f !== font),
      });
    } else {
      setTextSettings({
        ...textSettings,
        selectedFonts: [...textSettings.selectedFonts, font],
      });
    }
  };

  const handleUseAllFonts = (event) => {
    setTextSettings({
      ...textSettings,
      useAllFonts: event.target.checked,
      selectedFonts: event.target.checked ? fontOptions : textSettings.selectedFonts,
    });
  };

  const handleGenerate = async (numberOfVideos) => {
    setGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Read hooks from file
      const hooksText = await files.hooks.text();
      const hooks = hooksText.split('\n').filter(hook => hook.trim());

      const result = await videoService.generateBatch({
        mainVideo: files.mainVideo,
        secondaryVideos: files.secondaryVideos,
        hooks,
        music: files.music,
        textSettings,
        numberOfVideos
      });

      setGeneratedVideos(result.results);
      
      if (result.errors.length > 0) {
        setError(`Generated ${result.results.length} videos with ${result.errors.length} errors.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadTemplate = (settings) => {
    setTextSettings(settings);
  };

  const UploadStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <VideoPreview
              videoFile={files.mainVideo}
              textSettings={textSettings}
              hookText="Example Hook Text"
              musicFile={files.music}
              isPart1={true}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <VideoPreview
              videoFile={files.secondaryVideos[0]}
              textSettings={textSettings}
              hookText="Example Hook Text"
              musicFile={files.music}
              isPart1={false}
            />
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Main Video (Part 1)
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Upload Video
              <input
                type="file"
                hidden
                accept="video/*,image/*"
                onChange={(e) => handleFileUpload('mainVideo', e)}
              />
            </Button>
            {files.mainVideo && (
              <Typography variant="body2" mt={1}>
                Selected: {files.mainVideo.name}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Secondary Videos (Part 2)
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Upload Videos
              <input
                type="file"
                hidden
                multiple
                accept="video/*,image/*"
                onChange={(e) => handleFileUpload('secondaryVideos', e)}
              />
            </Button>
            {files.secondaryVideos.length > 0 && (
              <Typography variant="body2" mt={1}>
                Selected: {files.secondaryVideos.length} files
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Hooks File
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Upload TXT
              <input
                type="file"
                hidden
                accept=".txt"
                onChange={(e) => handleFileUpload('hooks', e)}
              />
            </Button>
            {files.hooks && (
              <Typography variant="body2" mt={1}>
                Selected: {files.hooks.name}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Background Music
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
            >
              Upload Music
              <input
                type="file"
                hidden
                accept="audio/*"
                onChange={(e) => handleFileUpload('music', e)}
              />
            </Button>
            {files.music && (
              <Typography variant="body2" mt={1}>
                Selected: {files.music.name}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const TextStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={() => setIsTemplateManagerOpen(true)}
          >
            Sauvegarder/Charger Template
          </Button>
        </Box>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Font Settings
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={textSettings.useAllFonts}
                  onChange={handleUseAllFonts}
                />
              }
              label="Use All Fonts"
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Fonts:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {fontOptions.map((font) => (
                  <Chip
                    key={font}
                    label={font}
                    onClick={() => handleFontToggle(font)}
                    color={textSettings.selectedFonts.includes(font) ? "primary" : "default"}
                    sx={{ m: 0.5 }}
                    disabled={textSettings.useAllFonts}
                  />
                ))}
              </Stack>
            </Box>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Text Animation</InputLabel>
              <Select
                value={textSettings.textAnimation}
                label="Text Animation"
                onChange={(e) => setTextSettings({ ...textSettings, textAnimation: e.target.value })}
              >
                {textAnimations.map((animation) => (
                  <MenuItem key={animation} value={animation}>
                    {animation}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Text Styling
            </Typography>
            <Typography gutterBottom>Text Size</Typography>
            <Slider
              value={textSettings.textSize}
              onChange={(e, newValue) => setTextSettings({ ...textSettings, textSize: newValue })}
              min={24}
              max={72}
              valueLabelDisplay="auto"
              sx={{ mb: 3 }}
            />
            <Typography gutterBottom>Text Color</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
              {textColors.map((color) => (
                <IconButton
                  key={color}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: color,
                    border: textSettings.textColor === color ? '2px solid #000' : 'none',
                    '&:hover': { bgcolor: color },
                  }}
                  onClick={() => setTextSettings({ ...textSettings, textColor: color })}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Video Duration
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>Part 1 Duration (seconds)</Typography>
                <Slider
                  value={textSettings.duration.part1}
                  onChange={(e, newValue) => setTextSettings({
                    ...textSettings,
                    duration: { ...textSettings.duration, part1: newValue }
                  })}
                  min={1}
                  max={30}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>Part 2 Duration (seconds)</Typography>
                <Slider
                  value={textSettings.duration.part2}
                  onChange={(e, newValue) => setTextSettings({
                    ...textSettings,
                    duration: { ...textSettings.duration, part2: newValue }
                  })}
                  min={1}
                  max={30}
                  valueLabelDisplay="auto"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const GenerateStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Generation Settings
            </Typography>
            <TextField
              fullWidth
              label="Number of Videos to Generate"
              type="number"
              defaultValue={10}
              margin="normal"
              inputProps={{ min: 1, max: 100 }}
            />
            {generating && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  {progress}% Complete
                </Typography>
              </Box>
            )}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            {generatedVideos.length > 0 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Successfully generated {generatedVideos.length} videos!
              </Alert>
            )}
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => handleGenerate(10)}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Videos'}
            </Button>
          </CardContent>
        </Card>
      </Grid>
      {generatedVideos.length > 0 && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generated Videos
              </Typography>
              <List>
                {generatedVideos.map((video, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={video} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" aria-label="open">
                        <OpenInNewIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return <UploadStep />;
      case 1:
        return <TextStep />;
      case 2:
        return <GenerateStep />;
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box sx={{ mt: 2, mb: 4 }}>{getStepContent(activeStep)}</Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => setIsTemplateManagerOpen(true)}
        >
          Templates
        </Button>
        <Box>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Retour
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={activeStep === steps.length - 1}
          >
            Suivant
          </Button>
        </Box>
      </Box>

      <TemplateManager
        open={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        currentSettings={textSettings}
        onLoadTemplate={handleLoadTemplate}
      />
    </Box>
  );
}

export default VideoCreator; 