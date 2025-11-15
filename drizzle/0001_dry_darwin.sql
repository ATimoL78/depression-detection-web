CREATE TABLE `assessmentReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`detectionId` int,
	`riskLevel` enum('low','medium','high') NOT NULL,
	`score` int NOT NULL,
	`recommendations` text,
	`reportData` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `detectionRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('face','dialogue','combined') NOT NULL,
	`resultData` text NOT NULL,
	`riskLevel` enum('low','medium','high'),
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `detectionRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dialogueRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`detectionId` int,
	`content` text NOT NULL,
	`analysisResult` text,
	`sentiment` enum('positive','neutral','negative'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dialogueRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emotionDiary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200),
	`content` text NOT NULL,
	`mood` varchar(50),
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emotionDiary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emotionHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`detectionId` int,
	`emotion` varchar(50) NOT NULL,
	`confidence` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emotionHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicalResources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('hospital','clinic','counselor','hotline') NOT NULL,
	`description` text,
	`address` text,
	`phone` varchar(50),
	`website` varchar(500),
	`city` varchar(100),
	`province` varchar(100),
	`rating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicalResources_id` PRIMARY KEY(`id`)
);
