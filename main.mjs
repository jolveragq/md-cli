#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import shell from 'shelljs';

program
  .version('1.0.0')
  .description('CLI For Massimo Dutti Developers');

program
  .command('branch')
  .description('This command creates a new branch')
  .action(async () => {
    async function getBranchDetails() {
      // Preguntar por el tipo de rama
      const { branchType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'branchType',
          message: 'Select the type of branch:',
          choices: ['feature', 'bugfix', 'wip'],
        },
      ]);

      // Preguntar por el nombre del ticket
      const { ticketName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'ticketName',
          message: 'Enter the ticket name (number only or "NO-TASK"):',
          validate: function (input) {
            const numberOnlyRegex = /^\d{1,6}$/;
            const ticketRegex = /^ECOMDUTI-\d{1,6}$/;
            if (input === 'NO-TASK' || numberOnlyRegex.test(input) || ticketRegex.test(input)) {
              return true;
            }
            return 'The format is incorrect. It should be a number (up to 6 digits), "ECOMDUTI-123456", or "NO-TASK".';
          },
        },
      ]);

      // Preguntar por la descripción
      const { description } = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Enter the branch description (max 150 characters, only letters, numbers, and spaces):',
          validate: function (input) {
            const descriptionRegex = /^[a-zA-Z0-9 ]+$/;
            if (input.length > 150) {
              return 'The description is too long. It should be 150 characters or less.';
            }
            if (!descriptionRegex.test(input)) {
              return 'The description can only contain letters, numbers, and spaces.';
            }
            return true;
          },
        },
      ]);

      return { branchType, ticketName, description };
    }

    let validInput = false;
    let branchDetails;

    while (!validInput) {
      try {
        branchDetails = await getBranchDetails();
        validInput = true; // Si llegamos aquí, la entrada es válida
      } catch (error) {
        console.error(chalk.red('An error occurred while getting branch details. Please try again.'), error);
      }
    }

    let { branchType, ticketName, description } = branchDetails;

    // Si el ticketName es solo números, agregar "ECOMDUTI-"
    const numberOnlyRegex = /^\d{1,6}$/;
    if (numberOnlyRegex.test(ticketName)) {
      ticketName = `ECOMDUTI-${ticketName}`;
    }

    // Procesar la descripción
    const formattedDescription = description.trim().replace(/\s+/g, '-');

    // Formar el nombre de la rama
    const branchName = `${branchType}/${ticketName}-${formattedDescription}`;

    console.log(chalk.green(`Branch type: ${branchType}`));
    console.log(chalk.green(`Ticket name: ${ticketName}`));
    console.log(chalk.green(`Formatted description: ${formattedDescription}`));
    console.log(chalk.green(`Creating branch: ${branchName}`));

    // Ejecutar el comando de git para crear la rama
    if (shell.exec(`git checkout -b "${branchName}"`).code !== 0) {
      console.error(chalk.red('Error: Git command failed'));
      shell.exit(1);
    } else {
      console.log(chalk.green(`Branch ${branchName} created successfully`));
    }
  });

program
  .command('commit')
  .description('Create a commit with a formatted message based on the branch name')
  .action(() => {
    try {
      const result = shell.exec('git symbolic-ref --short HEAD', { silent: true });

      if (result.code !== 0) {
        throw new Error('Failed to get the branch name');
      }

      const branchName = result.stdout.trim();
      const lastSlashIndex = branchName.lastIndexOf('/');
      const cleanedBranchName = branchName.substring(lastSlashIndex + 1);
      const parts = cleanedBranchName.split('-');
      // Validar el formato del nombre de la rama
      if (parts.length < 3 || (parts[0] !== 'ECOMDUTI' && parts[0] !== 'NO')) {
        throw new Error('The branch name does not have the correct format');
      }

      const prefix = parts[0] === 'NO' ? 'NO-TASK' : `${parts[0]}-${parts[1]}`;
      const description = parts.slice(2).join(' ');
      const commitMessage = `[${prefix}]: ${description}`;
      console.log(commitMessage);

      // Opción para crear el commit automáticamente
      if (shell.exec(`git commit --allow-empty -m "${commitMessage}"`).code !== 0) {
        console.error(chalk.red('Error: Git commit failed'));
        shell.exit(1);
      } else {
        console.log(chalk.green('Commit created successfully'));
      }

    } catch (error) {
      console.error(chalk.red('The branch name does not have the correct format or an error occurred.'), error);
    }
  });

program
  .command('generate-message')
  .description('Generate a message with RAMA, PR, and JIRA')
  .action(() => {
    try {
      // Obtener la rama actual
      const branch = shell.exec('git rev-parse --abbrev-ref HEAD', { silent: true }).stdout.trim();

      // Obtener el PR asociado
      const prNumber = shell.exec(`gh pr list --head ${branch} --json number --jq '.[0].number'`, { silent: true }).stdout.trim();

      // Obtener el ID de JIRA
      const jiraIdMatch = branch.match(/[A-Z]+-[0-9]+/);
      const jiraId = jiraIdMatch ? jiraIdMatch[0] : 'No JIRA ID found';

      // URLs base
      const prUrl = `https://github.com/inditex/web-duttinodefront/pull/${prNumber}`;
      const jiraUrl = `https://jira.inditex.com/jira/browse/${jiraId}`;

      // Mostrar el mensaje
      console.log(chalk.green(`RAMA: ${branch}`));
      console.log(chalk.green(`PR: ${prUrl}`));
      console.log(chalk.green(`JIRA: ${jiraUrl}`));
    } catch (error) {
      console.error(chalk.red('Failed to generate the message. Ensure you are on a valid branch and logged in to GitHub CLI.'), error);
    }
  });

program.parse(process.argv);
