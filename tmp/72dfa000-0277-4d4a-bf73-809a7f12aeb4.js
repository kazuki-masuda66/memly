
            const fs = require('fs');
            const pdfParse = require('pdf-parse');
            
            const dataBuffer = fs.readFileSync('tmp\\23969eb1-c3f4-4ad1-98e4-ea91df42a925.pdf');
            
            pdfParse(dataBuffer).then(data => {
              console.log(JSON.stringify({ text: data.text }));
            }).catch(err => {
              console.error(JSON.stringify({ error: err.message }));
              process.exit(1);
            });
          