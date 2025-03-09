
              const fs = require('fs');
              const pdfParse = require('pdf-parse');
              
              const dataBuffer = fs.readFileSync('tmp\\255f1da0-2e73-4192-9a5d-007183542641.pdf');
              
              pdfParse(dataBuffer).then(data => {
                console.log(JSON.stringify({ text: data.text }));
              }).catch(err => {
                console.error(JSON.stringify({ error: err.message }));
                process.exit(1);
              });
            